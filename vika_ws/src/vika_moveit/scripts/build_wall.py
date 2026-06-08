#!/usr/bin/env python3
"""Pick-and-place demo: take 6 bricks from the pallet and build a wall.

No real gripping — bricks are attached via MoveIt AttachedCollisionObject
when the TCP reaches the side of the brick (acts like a magnet).

Run after start-full.sh (Gazebo + MoveIt + RViz up):
  ros2 run vika_moveit build_wall.py
"""
import time
import math
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.executors import MultiThreadedExecutor

from geometry_msgs.msg import Pose, PoseStamped
from moveit_msgs.action import MoveGroup
from moveit_msgs.msg import (
    MotionPlanRequest, Constraints, PositionConstraint, OrientationConstraint,
    PlanningOptions, AttachedCollisionObject, CollisionObject, PlanningScene,
)
from shape_msgs.msg import SolidPrimitive
from std_msgs.msg import Header
from control_msgs.action import FollowJointTrajectory
from trajectory_msgs.msg import JointTrajectoryPoint
from builtin_interfaces.msg import Duration

# Pallet geometry (must match publish_scene.py / construction_site.sdf)
PALLET_X = 1.4
PALLET_TOP_Z = 0.144
BRICK_DIMS = (0.375, 0.250, 0.238)  # X, Y, Z

# Brick source positions on pallet (must match publish_scene.py)
SRC_POSES = [
    (PALLET_X + dx, dy, PALLET_TOP_Z)
    for dx in (-0.20, 0.20)
    for dy in (-0.27, 0.0, 0.27)
]

# Wall target — 6 bricks in a row at front of robot
WALL_X = 0.7
WALL_Y0 = -0.4
WALL_Z = 0.0
WALL_PITCH = 0.30  # spacing along Y
WALL_POSES = [(WALL_X, WALL_Y0 + i * WALL_PITCH, WALL_Z) for i in range(6)]

# Gripper approaches each brick from the -X side (front)
APPROACH_OFFSET = 0.30  # m back from brick face
LIFT_HEIGHT = 0.30      # m above for safe motion
PLANNING_TIME = 5.0
GROUP = "arm"
EE_LINK = "tcp"


def make_pose(x, y, z, roll=0.0, pitch=0.0, yaw=0.0) -> Pose:
    p = Pose()
    p.position.x, p.position.y, p.position.z = x, y, z
    # ZYX Euler -> quaternion
    cy, sy = math.cos(yaw / 2), math.sin(yaw / 2)
    cp, sp = math.cos(pitch / 2), math.sin(pitch / 2)
    cr, sr = math.cos(roll / 2), math.sin(roll / 2)
    p.orientation.w = cr * cp * cy + sr * sp * sy
    p.orientation.x = sr * cp * cy - cr * sp * sy
    p.orientation.y = cr * sp * cy + sr * cp * sy
    p.orientation.z = cr * cp * sy - sr * sp * cy
    return p


class WallBuilder(Node):
    def __init__(self):
        super().__init__("vika_wall_builder")
        self.cb = ReentrantCallbackGroup()
        self.move_client = ActionClient(self, MoveGroup, "/move_action", callback_group=self.cb)
        self.traj_client = ActionClient(self, FollowJointTrajectory,
                                         "/arm_controller/follow_joint_trajectory",
                                         callback_group=self.cb)
        self.scene_pub = self.create_publisher(PlanningScene, "/planning_scene", 10)
        self.get_logger().info("Waiting for /move_action and /arm_controller ...")
        self.move_client.wait_for_server()
        self.traj_client.wait_for_server()
        self.get_logger().info("Connected. Building wall.")

    def force_home(self):
        """Direct controller command: move all joints to 0, bypassing MoveIt collision."""
        from trajectory_msgs.msg import JointTrajectory
        goal = FollowJointTrajectory.Goal()
        goal.trajectory = JointTrajectory()
        goal.trajectory.joint_names = ["j1", "j2", "j3", "j4", "j5", "j6"]
        pt = JointTrajectoryPoint()
        pt.positions = [0.0] * 6
        pt.time_from_start = Duration(sec=4)
        goal.trajectory.points = [pt]
        future = self.traj_client.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, future, timeout_sec=5)
        gh = future.result()
        if not gh or not gh.accepted:
            self.get_logger().error("Home goal rejected"); return
        rf = gh.get_result_async()
        rclpy.spin_until_future_complete(self, rf, timeout_sec=15)
        self.get_logger().info("  Robot at home pose")

    def goto_pose(self, pose: Pose, link: str = EE_LINK) -> bool:
        goal = MoveGroup.Goal()
        req = MotionPlanRequest()
        req.group_name = GROUP
        req.num_planning_attempts = 5
        req.allowed_planning_time = PLANNING_TIME
        req.max_velocity_scaling_factor = 0.5
        req.max_acceleration_scaling_factor = 0.5

        # Position constraint: small box around target
        pc = PositionConstraint()
        pc.header.frame_id = "world"
        pc.link_name = link
        pc.weight = 1.0
        pc.target_point_offset.x = pc.target_point_offset.y = pc.target_point_offset.z = 0.0
        bv = SolidPrimitive(); bv.type = SolidPrimitive.BOX; bv.dimensions = [0.05, 0.05, 0.05]
        pc.constraint_region.primitives.append(bv)
        pc.constraint_region.primitive_poses.append(pose)

        # Orientation constraint (loose — Z direction matters, free roll)
        oc = OrientationConstraint()
        oc.header.frame_id = "world"
        oc.link_name = link
        oc.orientation = pose.orientation
        oc.absolute_x_axis_tolerance = 0.5
        oc.absolute_y_axis_tolerance = 0.5
        oc.absolute_z_axis_tolerance = 3.14  # full free yaw
        oc.weight = 1.0

        c = Constraints()
        c.position_constraints = [pc]
        # No orientation constraint — let IK pick any orientation
        req.goal_constraints = [c]

        goal.request = req
        goal.planning_options = PlanningOptions()
        goal.planning_options.plan_only = False

        future = self.move_client.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, future, timeout_sec=PLANNING_TIME + 5)
        gh = future.result()
        if not gh or not gh.accepted:
            self.get_logger().error("Goal rejected")
            return False
        result_future = gh.get_result_async()
        rclpy.spin_until_future_complete(self, result_future, timeout_sec=30.0)
        result = result_future.result()
        if not result:
            self.get_logger().error("No result"); return False
        ec = result.result.error_code.val
        ok = (ec == 1)
        self.get_logger().info(f"  motion result: {'OK' if ok else f'FAIL (code {ec})'}")
        return ok

    def attach_brick(self, brick_id: str, sx: float, sy: float, sz: float):
        """Phantom brick attached to gripper_base, dangling below the TCP."""
        ps = PlanningScene(); ps.is_diff = True
        aco = AttachedCollisionObject()
        aco.link_name = "gripper_base"
        # frame_id MUST be the link_name for relative pose interpretation
        aco.object.header.frame_id = "gripper_base"
        aco.object.id = brick_id
        prim = SolidPrimitive(); prim.type = SolidPrimitive.BOX
        prim.dimensions = list(BRICK_DIMS)
        aco.object.primitives = [prim]
        pose = Pose()
        # Brick hangs ~15cm below gripper, centered. Local frame.
        pose.position.x, pose.position.y, pose.position.z = 0.0, 0.0, 0.15
        pose.orientation.w = 1.0
        aco.object.primitive_poses = [pose]
        aco.object.operation = CollisionObject.ADD
        aco.touch_links = ["gripper_base", "tool0", "link6", "link5"]
        ps.robot_state.attached_collision_objects.append(aco)
        self.scene_pub.publish(ps)
        time.sleep(0.5)
        self.get_logger().info(f"  attached {brick_id}")

    def detach_brick_at(self, brick_id: str, x: float, y: float, z: float):
        ps = PlanningScene(); ps.is_diff = True
        # Detach
        aco = AttachedCollisionObject()
        aco.link_name = "gripper_base"
        aco.object.id = brick_id
        aco.object.operation = CollisionObject.REMOVE
        ps.robot_state.attached_collision_objects.append(aco)
        # Add to world at new place position
        co = CollisionObject()
        co.header.frame_id = "world"
        co.id = brick_id
        prim = SolidPrimitive(); prim.type = SolidPrimitive.BOX
        prim.dimensions = list(BRICK_DIMS)
        co.primitives = [prim]
        pose = Pose()
        pose.position.x, pose.position.y, pose.position.z = x, y, z + BRICK_DIMS[2] / 2
        pose.orientation.w = 1.0
        co.primitive_poses = [pose]
        co.operation = CollisionObject.ADD
        ps.world.collision_objects.append(co)
        self.scene_pub.publish(ps)
        time.sleep(0.5)
        self.get_logger().info(f"  placed {brick_id} at ({x:.2f}, {y:.2f}, {z:.2f})")

    def grasp_pose(self, bx, by, bz) -> tuple[Pose, Pose]:
        """Single waypoint above the brick — gripper hovers, brick magnetically attaches."""
        top_z = bz + BRICK_DIMS[2]
        pre = make_pose(bx, by, top_z + 0.40, math.pi, 0.0, 0.0)
        grasp = make_pose(bx, by, top_z + 0.30, math.pi, 0.0, 0.0)
        return pre, grasp

    def place_pose(self, wx, wy, wz) -> tuple[Pose, Pose]:
        """Single waypoint above wall slot — brick is detached from there."""
        top_z = wz + BRICK_DIMS[2]
        pre = make_pose(wx, wy, top_z + 0.40, math.pi, 0.0, 0.0)
        place = make_pose(wx, wy, top_z + 0.30, math.pi, 0.0, 0.0)
        return pre, place

    def goto_named(self, name: str = "home") -> bool:
        from moveit_msgs.msg import JointConstraint
        joints = ["j1", "j2", "j3", "j4", "j5", "j6"]
        # SRDF "home" group_state has all 0
        c = Constraints()
        for j in joints:
            jc = JointConstraint()
            jc.joint_name = j
            jc.position = 0.0
            jc.tolerance_above = 0.05
            jc.tolerance_below = 0.05
            jc.weight = 1.0
            c.joint_constraints.append(jc)
        goal = MoveGroup.Goal()
        req = MotionPlanRequest()
        req.group_name = GROUP
        req.num_planning_attempts = 5
        req.allowed_planning_time = PLANNING_TIME
        req.max_velocity_scaling_factor = 0.5
        req.max_acceleration_scaling_factor = 0.5
        req.goal_constraints = [c]
        goal.request = req
        goal.planning_options = PlanningOptions()
        goal.planning_options.plan_only = False
        future = self.move_client.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, future, timeout_sec=PLANNING_TIME + 5)
        gh = future.result()
        if not gh or not gh.accepted:
            return False
        rf = gh.get_result_async()
        rclpy.spin_until_future_complete(self, rf, timeout_sec=30.0)
        result = rf.result()
        ok = result and result.result.error_code.val == 1
        self.get_logger().info(f"  home: {'OK' if ok else 'FAIL'}")
        return ok

    def build(self):
        self.get_logger().info("=== Forcing arm to home (bypassing MoveIt) ===")
        self.force_home()
        time.sleep(1.0)

        for i, (sx, sy, sz) in enumerate(SRC_POSES):
            wx, wy, wz = WALL_POSES[i]
            brick_id = f"brick_{i}"
            self.get_logger().info(f"=== Brick {i}: pick ({sx:.2f},{sy:.2f}) → place ({wx:.2f},{wy:.2f}) ===")

            # Force-home before each pick to avoid stuck-in-collision states
            self.force_home()
            time.sleep(0.3)

            # Pick: hover above brick
            pre_g, _ = self.grasp_pose(sx, sy, sz)
            if not self.goto_pose(pre_g):
                self.get_logger().warn(f"  could not reach pick {i}, skipping")
                continue

            # Place: hover above wall slot
            pre_p, _ = self.place_pose(wx, wy, wz)
            if not self.goto_pose(pre_p):
                self.get_logger().warn(f"  could not reach place {i}, skipping")
                continue

            # "Place" the brick: spawn a new collision object at wall position
            self.detach_brick_at(brick_id, wx, wy, wz)

        self.get_logger().info("=== Wall complete ===")


def main():
    rclpy.init()
    node = WallBuilder()
    try:
        node.build()
    except KeyboardInterrupt:
        pass
    rclpy.shutdown()


if __name__ == "__main__":
    main()
