#!/usr/bin/env python3
"""Move both arms to a folded 'stow' pose at startup so the opposite-facing
robots don't reach toward the centre and overlap ('kissing'). Uses the
FollowJointTrajectory action (robust goal handshake, unlike a topic publish
that races discovery). Run inside the container once controllers are active.
"""
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from control_msgs.action import FollowJointTrajectory
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
from builtin_interfaces.msg import Duration

# j1=+90deg points the arm along its rail (away from the centre -> no kissing).
# j2=0 keeps the shoulder in its clean home attitude so link1/link2 stay clear
# of the base (a negative j2 pitched them into it); j3 gives a gentle elbow fold.
FOLD = [1.5708, 0.0, 0.6, 0.0, 0.0, 0.0]
ROBOTS = ["robot_a", "robot_b"]


def fold(node, name):
    joints = [f"{name}_arm_j{i}" for i in range(1, 7)]
    ac = ActionClient(node, FollowJointTrajectory,
                      f"/{name}/arm_controller/follow_joint_trajectory")
    if not ac.wait_for_server(timeout_sec=15.0):
        node.get_logger().error(f"{name}: action server unavailable")
        return
    pt = JointTrajectoryPoint(positions=FOLD, time_from_start=Duration(sec=3))
    goal = FollowJointTrajectory.Goal()
    goal.trajectory = JointTrajectory(joint_names=joints, points=[pt])
    gf = ac.send_goal_async(goal)
    rclpy.spin_until_future_complete(node, gf, timeout_sec=10.0)
    gh = gf.result()
    if gh is None or not gh.accepted:
        node.get_logger().error(f"{name}: fold goal rejected")
        return
    rf = gh.get_result_async()
    rclpy.spin_until_future_complete(node, rf, timeout_sec=12.0)
    node.get_logger().info(f"{name}: folded")


def main():
    rclpy.init()
    n = rclpy.create_node("fold_arms")
    for r in ROBOTS:
        fold(n, r)
    n.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
