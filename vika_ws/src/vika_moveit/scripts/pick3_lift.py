#!/usr/bin/env python3
"""Phase 1b: pick up all 3 bricks at once.

Sequence (IK via MoveIt /compute_ik, execute on the live arm_controller):
  1. hover above the brick row
  2. lower so the suction bar meets the 3 bricks
  3. fire the 3 vacuum DetachableJoints (attach)
  4. lift -> the 3 bricks are carried up with the gripper

Run with no args for the full sequence, or `release` to drop them.
"""
import sys
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from moveit_msgs.srv import GetPositionIK
from geometry_msgs.msg import PoseStamped
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
from control_msgs.action import FollowJointTrajectory
from std_msgs.msg import Empty
from sensor_msgs.msg import JointState
from builtin_interfaces.msg import Duration

ARM = [f"robot_a_arm_j{i}" for i in range(1, 7)]
# Known-good top-down branch over the brick row. Seeding IK with this keeps it
# from wandering to awkward wrist-flipped solutions (j6 near its limit).
SEED = [-0.02, -0.34, -0.78, -0.58, -0.01, -1.42]
# LÄNGS pick: bricks lined up along world X at y=+0.29. Tool +Z points down and
# the gripper bar (local Y) maps to world X so the 3 pads span the 3 bricks
# end-to-end. That orientation is a 180deg rotation about the (1,1,0) axis.
XY = (-0.6, 0.29)  # längs row in front of robot_a (move_group world = gz world)
QUAT = (0.70710678, 0.70710678, 0.0, 0.0)  # x,y,z,w
PADS = ["r", "c", "l"]


class Pick(Node):
    def __init__(self):
        super().__init__("pick3_lift")
        self.ik = self.create_client(GetPositionIK, "/compute_ik")
        # Robust execution via the controller's FollowJointTrajectory ACTION —
        # the goal handshake waits for the server, so no discovery race (a single
        # topic publish was silently dropped before the controller subscribed).
        self.ac = ActionClient(self, FollowJointTrajectory,
                               "/robot_a/arm_controller/follow_joint_trajectory")
        self.attach = {p: self.create_publisher(Empty, f"/suction/{p}/attach", 10) for p in PADS}
        self.detach = {p: self.create_publisher(Empty, f"/suction/{p}/detach", 10) for p in PADS}

    def _spin(self, secs):
        end = self.get_clock().now()
        while (self.get_clock().now() - end).nanoseconds < secs * 1e9:
            rclpy.spin_once(self, timeout_sec=0.05)

    def solve(self, z):
        self.ik.wait_for_service(timeout_sec=10.0)
        req = GetPositionIK.Request()
        r = req.ik_request
        r.group_name = "arm"
        r.ik_link_name = "robot_a_arm_tcp"
        r.avoid_collisions = False
        r.timeout.sec = 2
        # Seed IK with a known-good top-down branch so it stays on robot_a's
        # side and doesn't pick a wrist-flipped pose that swings to the centre.
        seed = JointState()
        seed.name = ARM
        seed.position = SEED
        r.robot_state.joint_state = seed
        ps = PoseStamped()
        ps.header.frame_id = "world"
        ps.pose.position.x, ps.pose.position.y, ps.pose.position.z = XY[0], XY[1], z
        (ps.pose.orientation.x, ps.pose.orientation.y,
         ps.pose.orientation.z, ps.pose.orientation.w) = QUAT
        r.pose_stamped = ps
        fut = self.ik.call_async(req)
        rclpy.spin_until_future_complete(self, fut, timeout_sec=8.0)
        res = fut.result()
        if res is None or res.error_code.val != 1:
            self.get_logger().error(f"IK failed at z={z} (code={getattr(res,'error_code',None)})")
            return None
        sol = {n: p for n, p in zip(res.solution.joint_state.name, res.solution.joint_state.position)}
        return [sol[j] for j in ARM]

    def goto(self, z, secs=4, settle=1.0):
        q = self.solve(z)
        if q is None:
            return False
        if not self.ac.wait_for_server(timeout_sec=10.0):
            self.get_logger().error("arm_controller action server unavailable")
            return False
        pt = JointTrajectoryPoint()
        pt.positions = [float(x) for x in q]
        pt.time_from_start = Duration(sec=int(secs))
        goal = FollowJointTrajectory.Goal()
        goal.trajectory = JointTrajectory(joint_names=ARM, points=[pt])
        gf = self.ac.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, gf, timeout_sec=10.0)
        gh = gf.result()
        if gh is None or not gh.accepted:
            self.get_logger().error(f"goal rejected at z={z}")
            return False
        rf = gh.get_result_async()
        rclpy.spin_until_future_complete(self, rf, timeout_sec=secs + 8.0)
        self._spin(settle)
        self.get_logger().info(f"reached z={z}")
        return True

    def fire(self, pubs, label):
        # DetachableJoint creates a NEW joint on EVERY attach msg, so publish
        # EXACTLY ONCE per pad — but only after the bridge has subscribed, else
        # the single message is lost to discovery latency.
        for p in PADS:
            t0 = self.get_clock().now()
            while pubs[p].get_subscription_count() < 1 and (self.get_clock().now() - t0).nanoseconds < 5e9:
                rclpy.spin_once(self, timeout_sec=0.1)
        self._spin(0.3)
        for p in PADS:
            pubs[p].publish(Empty()); rclpy.spin_once(self, timeout_sec=0.05)
        self._spin(1.0)
        self.get_logger().info(f"{label} sent once on r/c/l")


def main():
    rclpy.init()
    n = Pick()
    if len(sys.argv) > 1 and sys.argv[1] == "release":
        n.fire(n.detach, "DETACH")
    else:
        n.goto(0.55, secs=4)      # hover above row
        n.goto(0.40, secs=3)      # lower onto bricks
        n.fire(n.attach, "ATTACH")
        n.goto(0.80, secs=4)      # lift the 3 bricks
    n.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
