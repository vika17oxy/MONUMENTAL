#!/usr/bin/env python3
"""Minimal: home → hover above brick 0. Nothing else."""
import math
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient

from geometry_msgs.msg import Pose
from moveit_msgs.action import MoveGroup
from moveit_msgs.msg import (
    MotionPlanRequest, Constraints, PositionConstraint, OrientationConstraint, PlanningOptions,
)
from shape_msgs.msg import SolidPrimitive
from control_msgs.action import FollowJointTrajectory
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
from builtin_interfaces.msg import Duration


# Target: above brick at (1.20, -0.27, 0.144), hovering high
TARGET_X = 1.20
TARGET_Y = -0.27
TARGET_Z = 1.20   # higher hover, easier IK with Z-down


class GotoBrick(Node):
    def __init__(self):
        super().__init__("goto_brick")
        self.move_client = ActionClient(self, MoveGroup, "/move_action")
        self.traj_client = ActionClient(self, FollowJointTrajectory,
                                         "/arm_controller/follow_joint_trajectory")
        self.get_logger().info("Waiting for action servers ...")
        self.move_client.wait_for_server()
        self.traj_client.wait_for_server()
        self.get_logger().info("Connected.")

    def force_home(self):
        goal = FollowJointTrajectory.Goal()
        goal.trajectory = JointTrajectory()
        goal.trajectory.joint_names = ["j1", "j2", "j3", "j4", "j5", "j6"]
        pt = JointTrajectoryPoint()
        pt.positions = [0.0] * 6
        pt.time_from_start = Duration(sec=4)
        goal.trajectory.points = [pt]
        f = self.traj_client.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, f, timeout_sec=5)
        gh = f.result()
        if not gh or not gh.accepted:
            self.get_logger().error("home rejected"); return False
        rf = gh.get_result_async()
        rclpy.spin_until_future_complete(self, rf, timeout_sec=15)
        self.get_logger().info("at home")
        return True

    def goto(self, x, y, z) -> bool:
        self.get_logger().info(f"  goto ({x:.2f}, {y:.2f}, {z:.2f})")
        goal = MoveGroup.Goal()
        req = MotionPlanRequest()
        req.group_name = "arm"
        req.num_planning_attempts = 10
        req.allowed_planning_time = 5.0
        req.max_velocity_scaling_factor = 0.5
        req.max_acceleration_scaling_factor = 0.5

        pc = PositionConstraint()
        pc.header.frame_id = "world"
        pc.link_name = "tcp"
        pc.weight = 1.0
        bv = SolidPrimitive(); bv.type = SolidPrimitive.BOX
        bv.dimensions = [0.10, 0.10, 0.10]   # generous box, IK has freedom
        pose = Pose()
        pose.position.x, pose.position.y, pose.position.z = x, y, z
        # TCP-Z down: identity quaternion if URDF gripper_to_tcp rpy is set.
        pose.orientation.x = 0.0
        pose.orientation.y = 0.0
        pose.orientation.z = 0.0
        pose.orientation.w = 1.0
        pc.constraint_region.primitives.append(bv)
        pc.constraint_region.primitive_poses.append(pose)

        oc = OrientationConstraint()
        oc.header.frame_id = "world"
        oc.link_name = "tcp"
        oc.orientation = pose.orientation
        oc.absolute_x_axis_tolerance = 0.3
        oc.absolute_y_axis_tolerance = 0.3
        oc.absolute_z_axis_tolerance = 3.14
        oc.weight = 1.0

        c = Constraints()
        c.position_constraints = [pc]
        c.orientation_constraints = [oc]
        req.goal_constraints = [c]

        goal.request = req
        goal.planning_options = PlanningOptions()
        goal.planning_options.plan_only = False

        f = self.move_client.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, f, timeout_sec=10)
        gh = f.result()
        if not gh or not gh.accepted:
            self.get_logger().error("goal rejected"); return False
        rf = gh.get_result_async()
        rclpy.spin_until_future_complete(self, rf, timeout_sec=30)
        result = rf.result()
        if not result:
            self.get_logger().error("no result"); return False
        ec = result.result.error_code.val
        ok = (ec == 1)
        self.get_logger().info(f"  result: {'OK' if ok else f'FAIL (code {ec})'}")
        return ok


def main():
    rclpy.init()
    n = GotoBrick()
    n.force_home()
    n.goto(TARGET_X, TARGET_Y, TARGET_Z)
    rclpy.shutdown()


if __name__ == "__main__":
    main()
