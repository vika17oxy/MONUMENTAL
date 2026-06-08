#!/usr/bin/env python3
"""HMI ↔ ROS bridge.

Subscribes to topics the dashboard publishes via rosbridge and translates
them into robot motion. Keeps the dashboard layer dumb (just publishes
JSON over WebSocket) while all the ROS plumbing lives here.

Topics in:
  /hmi/cmd          std_msgs/String       "HOME" | "STOP"
  /hmi/joint_jog    std_msgs/Float64MultiArray   6 joint deltas (rad)
  /hmi/tcp_jog      geometry_msgs/Vector3 dx, dy, dz (m) in world frame on tcp

Topics out:
  /arm_controller/follow_joint_trajectory  (action — direct trajectory)
  /move_action                             (action — IK via MoveIt)
"""
import math
import threading
import time

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient

from std_msgs.msg import String, Float64MultiArray
from geometry_msgs.msg import Vector3, Pose, PoseStamped
from sensor_msgs.msg import JointState
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
from builtin_interfaces.msg import Duration
from control_msgs.action import FollowJointTrajectory
from moveit_msgs.action import MoveGroup
from moveit_msgs.msg import (
    MotionPlanRequest, Constraints, PositionConstraint, OrientationConstraint,
    PlanningOptions,
)
from shape_msgs.msg import SolidPrimitive

import tf2_ros


JOINTS = ["j1", "j2", "j3", "j4", "j5", "j6"]
HOME = [0.0] * 6


class HmiBridge(Node):
    def __init__(self):
        super().__init__("hmi_bridge")

        self.last_js = {}
        self.lock = threading.Lock()
        self.ik_busy = False
        self.traj_busy = False
        self.last_tcp_t = 0.0

        self.create_subscription(JointState, "/joint_states", self.on_js, 20)
        self.create_subscription(String, "/hmi/cmd", self.on_cmd, 10)
        self.create_subscription(Float64MultiArray, "/hmi/joint_jog", self.on_joint_jog, 10)
        self.create_subscription(Vector3, "/hmi/tcp_jog", self.on_tcp_jog, 10)

        self.tf_buf = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buf, self)

        self.traj_client = ActionClient(self, FollowJointTrajectory,
                                         "/arm_controller/follow_joint_trajectory")
        self.move_client = ActionClient(self, MoveGroup, "/move_action")

        self.get_logger().info("hmi_bridge ready — waiting for /hmi/cmd, /hmi/joint_jog, /hmi/tcp_jog")

    # ---------- state ----------
    def on_js(self, msg: JointState):
        with self.lock:
            for n, p in zip(msg.name, msg.position):
                self.last_js[n] = p

    def current_positions(self):
        with self.lock:
            return [self.last_js.get(j, 0.0) for j in JOINTS]

    # ---------- commands ----------
    def on_cmd(self, msg: String):
        cmd = msg.data.strip().upper()
        self.get_logger().info(f"cmd: {cmd}")
        if cmd == "HOME":
            self.send_traj(HOME, sec=4)
        elif cmd == "STOP":
            # Send current pose as zero-time goal to halt motion
            self.send_traj(self.current_positions(), sec=0, nsec=200_000_000)

    def on_joint_jog(self, msg: Float64MultiArray):
        if len(msg.data) != 6:
            self.get_logger().warn(f"joint_jog needs 6 values, got {len(msg.data)}")
            return
        cur = self.current_positions()
        target = [c + d for c, d in zip(cur, msg.data)]
        self.send_traj(target, sec=1)

    def on_tcp_jog(self, msg: Vector3):
        # Drop if a previous IK goal is still planning/executing.
        # MoveIt's trajectory_execution_manager segfaults if you push goals
        # while one is in flight — defending hard here.
        if self.ik_busy:
            self.get_logger().info("tcp_jog dropped (busy)")
            return
        # Min 300 ms between IK goals — even when nothing is busy, gives MoveIt
        # breathing room and prevents button-mash floods.
        now = time.monotonic()
        if now - self.last_tcp_t < 0.3:
            return
        self.last_tcp_t = now

        try:
            tf = self.tf_buf.lookup_transform("world", "tcp", rclpy.time.Time())
        except Exception as e:
            self.get_logger().warn(f"tf lookup world→tcp failed: {e}")
            return
        x = tf.transform.translation.x + msg.x
        y = tf.transform.translation.y + msg.y
        z = tf.transform.translation.z + msg.z
        self.send_ik(x, y, z)

    # ---------- senders ----------
    def send_traj(self, positions, sec=1, nsec=0):
        if not self.traj_client.wait_for_server(timeout_sec=2.0):
            self.get_logger().warn("arm_controller action server unavailable")
            return
        goal = FollowJointTrajectory.Goal()
        goal.trajectory = JointTrajectory()
        goal.trajectory.joint_names = JOINTS
        pt = JointTrajectoryPoint()
        pt.positions = list(positions)
        pt.time_from_start = Duration(sec=int(sec), nanosec=int(nsec))
        goal.trajectory.points = [pt]
        self.traj_client.send_goal_async(goal)

    def _on_ik_goal_response(self, future):
        gh = future.result()
        if not gh or not gh.accepted:
            self.ik_busy = False
            return
        result_future = gh.get_result_async()
        result_future.add_done_callback(lambda _f: setattr(self, "ik_busy", False))

    def send_ik(self, x, y, z):
        if not self.move_client.wait_for_server(timeout_sec=2.0):
            self.get_logger().warn("move_group action server unavailable")
            return
        self.ik_busy = True
        self.get_logger().info(f"IK goto ({x:.3f}, {y:.3f}, {z:.3f})")

        goal = MoveGroup.Goal()
        req = MotionPlanRequest()
        req.group_name = "arm"
        req.num_planning_attempts = 5
        req.allowed_planning_time = 2.0
        req.max_velocity_scaling_factor = 0.5
        req.max_acceleration_scaling_factor = 0.5

        pc = PositionConstraint()
        pc.header.frame_id = "world"
        pc.link_name = "tcp"
        pc.weight = 1.0
        bv = SolidPrimitive(); bv.type = SolidPrimitive.BOX
        bv.dimensions = [0.05, 0.05, 0.05]
        pose = Pose()
        pose.position.x, pose.position.y, pose.position.z = x, y, z
        pose.orientation.w = 1.0
        pc.constraint_region.primitives.append(bv)
        pc.constraint_region.primitive_poses.append(pose)

        oc = OrientationConstraint()
        oc.header.frame_id = "world"
        oc.link_name = "tcp"
        oc.orientation.w = 1.0
        oc.absolute_x_axis_tolerance = 3.14
        oc.absolute_y_axis_tolerance = 3.14
        oc.absolute_z_axis_tolerance = 3.14
        oc.weight = 0.5

        c = Constraints()
        c.position_constraints = [pc]
        c.orientation_constraints = [oc]
        req.goal_constraints = [c]

        goal.request = req
        goal.planning_options = PlanningOptions()
        goal.planning_options.plan_only = False
        future = self.move_client.send_goal_async(goal)
        future.add_done_callback(self._on_ik_goal_response)


def main():
    rclpy.init()
    n = HmiBridge()
    try:
        rclpy.spin(n)
    except KeyboardInterrupt:
        pass
    rclpy.shutdown()


if __name__ == "__main__":
    main()
