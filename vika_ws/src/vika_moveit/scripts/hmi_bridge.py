#!/usr/bin/env python3
"""HMI ↔ ROS bridge (namespaced, dual-robot).

Translates the dumb topics the web dashboard publishes via rosbridge into robot
motion. Joint control goes straight through the FollowJointTrajectory ACTION of
the selected robot's arm_controller — no IK, no MoveIt, so it is robust and
predictable (the right choice for a jog dashboard).

Topics in (from the HMI):
  /hmi/active_robot  std_msgs/String            "robot_a" | "robot_b"
  /hmi/cmd           std_msgs/String            "HOME" | "STOP"
  /hmi/joint_jog     std_msgs/Float64MultiArray 6 joint deltas (rad) for active robot
  /hmi/joint_set     std_msgs/Float64MultiArray 6 ABSOLUTE joint targets (rad) — sliders
  /hmi/rail_jog      std_msgs/Float64           rail delta (m) — the linear rail
  /hmi/suction       std_msgs/Bool              vacuum gripper on/off (robot_a)
  /hmi/tcp_jog       geometry_msgs/Vector3      dx,dy,dz (m) — Cartesian (needs move_group)

Per robot it drives:  /<robot>/arm_controller/follow_joint_trajectory   (6 arm joints)
                      /<robot>/rail_controller/follow_joint_trajectory  (linear rail)
"""
import threading
import time

import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient

from std_msgs.msg import String, Bool, Float64, Float64MultiArray, Empty
from geometry_msgs.msg import Vector3, Pose, Point
from sensor_msgs.msg import JointState
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
from builtin_interfaces.msg import Duration
from control_msgs.action import FollowJointTrajectory
from moveit_msgs.action import MoveGroup
from moveit_msgs.srv import GetCartesianPath
from moveit_msgs.msg import (
    MotionPlanRequest, Constraints, PositionConstraint, OrientationConstraint,
    PlanningOptions,
)
from shape_msgs.msg import SolidPrimitive
import tf2_ros

ROBOTS = ["robot_a", "robot_b"]
# Safe stow ("HOME") pose — folded along the rail, no kissing/collapse.
HOME_POSE = [1.5708, 0.0, 0.6, 0.0, 0.0, 0.0]


def joints_of(robot):
    return [f"{robot}_arm_j{i}" for i in range(1, 7)]


def tip_of(robot):
    # robot_b's IK tip is cement_base: rigid to j6, BEFORE the revolute
    # cement_angle, so the arm group stays a clean 6-DOF chain (matches the SRDF).
    return "robot_b_arm_cement_base" if robot == "robot_b" else f"{robot}_arm_tcp"


class HmiBridge(Node):
    def __init__(self):
        super().__init__("hmi_bridge")
        self.lock = threading.Lock()
        self.active = "robot_a"
        self.js = {r: {} for r in ROBOTS}                 # per-robot joint map
        self.ik_busy = False                              # drop overlapping IK goals
        self.ik_busy_t = 0.0                               # when ik_busy was set (stuck-guard)
        # Cartesian IK per robot — each has its own move_group: robot_a global
        # (/move_action), robot_b namespaced (/robot_b/move_action). Tip link is
        # <robot>_arm_tcp for both (gripper tcp / cement nozzle tip).
        self.move_client = {
            "robot_a": ActionClient(self, MoveGroup, "/move_action"),
            "robot_b": ActionClient(self, MoveGroup, "/robot_b/move_action"),
        }
        # straight-line Cartesian jog (constant orientation, same IK branch ->
        # no wrist flip / tool tumble; fast, no plan search)
        self.cart_client = {
            "robot_a": self.create_client(GetCartesianPath, "/compute_cartesian_path"),
            "robot_b": self.create_client(GetCartesianPath, "/robot_b/compute_cartesian_path"),
        }
        self.tf_buf = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buf, self)
        self.traj = {r: ActionClient(
            self, FollowJointTrajectory,
            f"/{r}/arm_controller/follow_joint_trajectory") for r in ROBOTS}
        self.rail = {r: ActionClient(
            self, FollowJointTrajectory,
            f"/{r}/rail_controller/follow_joint_trajectory") for r in ROBOTS}

        for r in ROBOTS:
            self.create_subscription(
                JointState, f"/{r}/joint_states",
                lambda m, r=r: self._on_js(r, m), 20)

        self.create_subscription(String, "/hmi/active_robot", self.on_active, 10)
        self.create_subscription(String, "/hmi/cmd", self.on_cmd, 10)
        self.create_subscription(Float64MultiArray, "/hmi/joint_jog", self.on_joint_jog, 10)
        self.create_subscription(Float64MultiArray, "/hmi/joint_set", self.on_joint_set, 10)
        self.create_subscription(Float64, "/hmi/rail_jog", self.on_rail_jog, 10)
        self.create_subscription(Float64, "/hmi/rail_to", self.on_rail_to, 10)   # absolute rail (mobile masonry)
        self.create_subscription(Bool, "/hmi/suction", self.on_suction, 10)
        # selective vacuum: data = pads to attach, e.g. "c" (one brick), "lcr"
        # (whole row), "" (release all). The others are detached.
        self.create_subscription(String, "/hmi/suck", self.on_suck, 10)
        self.create_subscription(Vector3, "/hmi/tcp_jog", self.on_tcp_jog, 10)
        # AI brick pick: drive the TCP above a detected brick (world point)
        self.create_subscription(Point, "/hmi/goto", self.on_goto, 10)
        # like goto but gripper yawed 90° -> place the row ALONG Y (wall runs in Y)
        self.create_subscription(Point, "/hmi/goto_yaw", self.on_goto_yaw, 10)

        # Vacuum gripper: one gz DetachableJoint per pick-ROW (3 bricks fused) on the
        # 3(Y)×4(Z) pallet — keyed "r{yi}_{zi}", e.g. "r2_3". The leading 'r' matters:
        # a ROS topic segment may NOT start with a digit, so "/suction/2_3/..." is
        # rejected. The gripper grabs a whole row at once -> 12 joints, not 36.
        self.ROWS = [f"r{yi}_{zi}" for yi in range(3) for zi in range(4)]
        self.attach_pub = {r: self.create_publisher(Empty, f"/suction/{r}/attach", 10) for r in self.ROWS}
        self.detach_pub = {r: self.create_publisher(Empty, f"/suction/{r}/detach", 10) for r in self.ROWS}

        self.get_logger().info("hmi_bridge ready (joint control) — active=robot_a")

    # ---------- state ----------
    def _on_js(self, robot, msg):
        with self.lock:
            for n, p in zip(msg.name, msg.position):
                self.js[robot][n] = p

    def current(self, robot):
        with self.lock:
            return [self.js[robot].get(j, 0.0) for j in joints_of(robot)]

    # ---------- inputs ----------
    def on_active(self, msg):
        r = msg.data.strip()
        if r in ROBOTS:
            self.active = r
            self.get_logger().info(f"active robot -> {r}")

    def on_cmd(self, msg):
        cmd = msg.data.strip().upper()
        if cmd == "HOME":
            self.send_traj(self.active, HOME_POSE, sec=4)
        elif cmd == "STOP":
            self.send_traj(self.active, self.current(self.active), sec=0, nsec=150_000_000)
        elif cmd == "READY":
            # IK to a top-down pose in the robot's work area — a good jog start.
            xyz = self.READY_XYZ.get(self.active)
            if xyz:
                self.send_ik(*xyz, self.READY_QUAT)

    def on_joint_jog(self, msg):
        if len(msg.data) != 6:
            self.get_logger().warn(f"joint_jog needs 6 deltas, got {len(msg.data)}")
            return
        r = self.active
        target = [c + d for c, d in zip(self.current(r), msg.data)]
        self.send_traj(r, target, sec=1)

    def on_joint_set(self, msg):
        if len(msg.data) != 6:
            self.get_logger().warn(f"joint_set needs 6 values, got {len(msg.data)}")
            return
        self.send_traj(self.active, list(msg.data), sec=1)

    def on_rail_jog(self, msg):
        r = self.active
        cur = self.js[r].get(f"{r}_rail_joint", 0.0)
        target = max(-8.0, min(8.0, cur + float(msg.data)))   # rail travel (per-robot URDF limit enforces direction)
        self._send(self.rail[r], [f"{r}_rail_joint"], [target], sec=1, what=f"{r} rail")

    def on_rail_to(self, msg):
        """Drive the rail carriage to an ABSOLUTE position (mobile masonry: the BT
        slides to the pallet to pick, then out along +Y to lay each segment)."""
        r = self.active
        target = max(-8.0, min(8.0, float(msg.data)))
        self._send(self.rail[r], [f"{r}_rail_joint"], [target], sec=4, what=f"{r} rail->{target:.2f}")

    def _attach_row(self, row):
        pub = self.attach_pub.get(row)
        if pub:
            for _ in range(3):                  # repeat — single gz pub can be lost
                pub.publish(Empty())

    def _release_all(self):
        for pub in self.detach_pub.values():
            for _ in range(3):
                pub.publish(Empty())

    def on_suction(self, msg):
        # manual vacuum toggle: grab the front-top row, or release everything
        if msg.data:
            self._attach_row("r0_3")
        else:
            self._release_all()
        self.get_logger().info(f"suction {'ON' if msg.data else 'OFF'}")

    def on_suck(self, msg):
        """Pallet pick: data = a pick-row key 'r{yi}_{zi}' (e.g. 'r2_3') -> attach that
        fused row of 3 bricks; manual pad strings ('l'/'lcr'/…) fall back to the
        front-top row; '' -> release all 12. The BT picks top-down."""
        d = msg.data.strip()
        if d in self.attach_pub:
            self._attach_row(d)
            self.get_logger().info(f"suck row {d}")
        elif d:
            self._attach_row("r0_3")            # manual SUCK -> grab accessible front-top row
            self.get_logger().info("suck (manual) -> r0_3")
        else:
            self._release_all()
            self.get_logger().info("release all")

    CART_SPEED = 0.3          # m/s for Cartesian (moveL) execution

    def on_tcp_jog(self, msg):
        """Small operator jog: a Cartesian (moveL) step — the TCP moves in a
        straight line, holding orientation. Used for the place descents too."""
        robot = self.active
        if self.ik_busy and (time.monotonic() - self.ik_busy_t) < 3.0:
            return
        tip = tip_of(robot)
        try:
            tf = self.tf_buf.lookup_transform("world", tip, rclpy.time.Time())
        except Exception as e:
            self.get_logger().warn(f"tf world->{tip} failed: {e}")
            return
        cart = self.cart_client[robot]
        if not cart.service_is_ready():
            self.get_logger().warn(f"{robot} compute_cartesian_path not ready")
            return
        t = tf.transform.translation
        self.ik_busy = True
        self.ik_busy_t = time.monotonic()
        self.ik_robot = robot
        req = GetCartesianPath.Request()
        req.header.frame_id = "world"
        req.start_state.is_diff = True
        req.group_name = "arm"
        req.link_name = tip
        wp = Pose()
        wp.position.x, wp.position.y, wp.position.z = t.x + msg.x, t.y + msg.y, t.z + msg.z
        # HOLD the CURRENT TCP orientation (not READY) so a jog after a rotated
        # place keeps that 90° yaw — needed for the längs-Y wall descents.
        wp.orientation = tf.transform.rotation
        req.waypoints = [wp]
        req.max_step = 0.01
        req.jump_threshold = 0.0
        req.avoid_collisions = False
        cart.call_async(req).add_done_callback(self._cart_done)

    def _cart_done(self, fut):
        try:
            resp = fut.result()
        except Exception as e:
            self.get_logger().warn(f"cartesian path failed: {e}")
            self.ik_busy = False
            return
        jt = resp.solution.joint_trajectory
        if resp.fraction < 0.5 or not jt.points:
            self.get_logger().warn(f"cartesian fraction {resp.fraction:.2f} too low — skip")
            self.ik_busy = False
            return
        robot = getattr(self, "ik_robot", "robot_a")
        name_to_pos = dict(zip(jt.joint_names, jt.points[-1].positions))
        ordered = [name_to_pos.get(j, 0.0) for j in joints_of(robot)]
        self.send_traj(robot, ordered, sec=0, nsec=250_000_000)
        self.ik_busy = False

    GOTO_APPROACH = 0.02      # descend to just above the brick top for a clean grab

    def on_goto(self, msg):
        """Reposition the TCP top-down above a target. Big repositioning moves
        plan with OMPL (smoothly time-parameterised) — executing a full Cartesian
        path here flings the sucked bricks, so the straight-line moveL is reserved
        for the small jog descents (on_tcp_jog)."""
        z = msg.z + self.GOTO_APPROACH
        self.get_logger().info(f"GOTO ({msg.x:.3f}, {msg.y:.3f}, hover z={z:.3f})")
        self.send_ik(msg.x, msg.y, z, self.READY_QUAT, ori_tol=0.03, plan_time=3.0)

    def on_goto_yaw(self, msg):
        """Like on_goto but with the gripper YAWED 90° — the carried längs row turns
        from spanning world X to spanning world Y, so bricks lay ALONG the rail (a
        wall that runs in Y, not across it)."""
        z = msg.z + self.GOTO_APPROACH
        self.get_logger().info(f"GOTO-YAW ({msg.x:.3f}, {msg.y:.3f}, z={z:.3f})")
        self.send_ik(msg.x, msg.y, z, self.PLACE_QUAT, ori_tol=0.03, plan_time=3.0)

    READY_XYZ = {
        "robot_a": (-0.6, 0.29, 0.6),    # over the pallet near VIKA-6's rail (gripper)
        "robot_b": (0.6, 0.29, 0.6),     # mirrored work area (cement nozzle)
    }
    READY_QUAT = (0.70710678, 0.70710678, 0.0, 0.0)   # tool down, längs (pads span X)
    PLACE_QUAT = (0.0, 1.0, 0.0, 0.0)                  # tool down, yawed 90° (pads span Y)

    def send_ik(self, x, y, z, quat, ori_tol=0.1, plan_time=2.0):
        """MoveGroup pose goal -> collision-free plan + execute, for the ACTIVE
        robot (its own move_group + arm_controller). ori_tol: orientation
        tolerance (rad); tight for READY/GOTO so the tool sits flat."""
        if self.ik_busy:
            return
        robot = self.active
        mc = self.move_client[robot]
        tip = tip_of(robot)
        if not mc.wait_for_server(timeout_sec=2.0):
            self.get_logger().warn(f"{robot} move_group unavailable")
            return
        self.ik_busy = True
        self.ik_busy_t = time.monotonic()
        self.get_logger().info(f"{robot} IK -> ({x:.3f}, {y:.3f}, {z:.3f})")
        goal = MoveGroup.Goal()
        req = MotionPlanRequest()
        req.group_name = "arm"
        req.num_planning_attempts = 6
        req.allowed_planning_time = plan_time
        req.max_velocity_scaling_factor = 0.7
        req.max_acceleration_scaling_factor = 0.7

        pc = PositionConstraint()
        pc.header.frame_id = "world"
        pc.link_name = tip
        pc.weight = 1.0
        box = SolidPrimitive(type=SolidPrimitive.BOX, dimensions=[0.03, 0.03, 0.03])
        pose = Pose()
        pose.position.x, pose.position.y, pose.position.z = x, y, z
        pose.orientation.w = 1.0
        pc.constraint_region.primitives.append(box)
        pc.constraint_region.primitive_poses.append(pose)

        oc = OrientationConstraint()
        oc.header.frame_id = "world"
        oc.link_name = tip
        oc.orientation.x, oc.orientation.y, oc.orientation.z, oc.orientation.w = quat
        oc.absolute_x_axis_tolerance = ori_tol
        oc.absolute_y_axis_tolerance = ori_tol
        oc.absolute_z_axis_tolerance = ori_tol
        oc.weight = 1.0

        req.goal_constraints = [Constraints(position_constraints=[pc],
                                            orientation_constraints=[oc])]
        goal.request = req
        goal.planning_options = PlanningOptions(plan_only=False)
        fut = mc.send_goal_async(goal)
        fut.add_done_callback(self._ik_accepted)

    def _ik_accepted(self, fut):
        gh = fut.result()
        if not gh or not gh.accepted:
            self.ik_busy = False
            return
        gh.get_result_async().add_done_callback(lambda _f: setattr(self, "ik_busy", False))

    # ---------- output ----------
    def send_traj(self, robot, positions, sec=1, nsec=0):
        self._send(self.traj[robot], joints_of(robot), positions, sec, nsec,
                   what=f"{robot} arm")

    def _send(self, ac, joint_names, positions, sec=1, nsec=0, what=""):
        if not ac.wait_for_server(timeout_sec=2.0):
            self.get_logger().warn(f"{what} action server unavailable")
            return
        goal = FollowJointTrajectory.Goal()
        goal.trajectory = JointTrajectory(joint_names=list(joint_names))
        pt = JointTrajectoryPoint()
        pt.positions = [float(p) for p in positions]
        pt.time_from_start = Duration(sec=int(sec), nanosec=int(nsec))
        goal.trajectory.points = [pt]
        ac.send_goal_async(goal)
        self.get_logger().info(f"{what} -> {[round(p, 3) for p in positions]}")


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
