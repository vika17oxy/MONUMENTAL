#!/usr/bin/env python3
"""Phase 1 reach test: ask MoveIt IK (/compute_ik) for a top-down TCP pose over
the centre brick row, then execute it on the live arm_controller.

Proves the 6-DOF arm (rail held separate) can place the 3-pad suction gripper
onto the 3-brick row. Pure IK + JointTrajectory execution (no planning scene).
"""
import sys
import rclpy
from rclpy.node import Node
from moveit_msgs.srv import GetPositionIK
from geometry_msgs.msg import PoseStamped
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint

ARM_JOINTS = [f"robot_a_arm_j{i}" for i in range(1, 7)]
# Brick stack centre is world (1.4, 0). Brick top ~0.382 m. Hover the suction
# face just above; orientation Ry(180deg) -> tool +Z points straight down,
# gripper bar (local Y) along world Y so the 3 pads span the 3-brick row.
TARGET_XYZ = (1.4, 0.0, float(sys.argv[1]) if len(sys.argv) > 1 else 0.45)
TARGET_QUAT = (0.0, 1.0, 0.0, 0.0)  # x,y,z,w  == Ry(pi)


class Pick3(Node):
    def __init__(self):
        super().__init__("pick3_reach")
        self.ik = self.create_client(GetPositionIK, "/compute_ik")
        self.traj_pub = self.create_publisher(
            JointTrajectory, "/robot_a/arm_controller/joint_trajectory", 10)

    def solve(self):
        if not self.ik.wait_for_service(timeout_sec=10.0):
            self.get_logger().error("/compute_ik unavailable"); return None
        req = GetPositionIK.Request()
        r = req.ik_request
        r.group_name = "arm"
        r.ik_link_name = "robot_a_arm_tcp"
        r.avoid_collisions = False
        r.timeout.sec = 2
        ps = PoseStamped()
        ps.header.frame_id = "world"
        ps.pose.position.x, ps.pose.position.y, ps.pose.position.z = TARGET_XYZ
        ps.pose.orientation.x, ps.pose.orientation.y, ps.pose.orientation.z, ps.pose.orientation.w = TARGET_QUAT
        r.pose_stamped = ps
        fut = self.ik.call_async(req)
        rclpy.spin_until_future_complete(self, fut, timeout_sec=8.0)
        res = fut.result()
        if res is None:
            self.get_logger().error("IK call timed out"); return None
        code = res.error_code.val
        if code != 1:
            self.get_logger().error(f"IK failed, MoveItErrorCode={code}"); return None
        js = res.solution.joint_state
        sol = {n: p for n, p in zip(js.name, js.position)}
        order = [round(sol[j], 4) for j in ARM_JOINTS]
        self.get_logger().info(f"IK OK. arm solution = {order}")
        return order

    def execute(self, positions, secs=4):
        jt = JointTrajectory()
        jt.joint_names = ARM_JOINTS
        pt = JointTrajectoryPoint()
        pt.positions = [float(p) for p in positions]
        pt.time_from_start.sec = secs
        jt.points = [pt]
        # wait until the controller subscription is actually connected
        t0 = self.get_clock().now()
        while self.traj_pub.get_subscription_count() < 1:
            rclpy.spin_once(self, timeout_sec=0.1)
            if (self.get_clock().now() - t0).nanoseconds > 5e9:
                self.get_logger().error("no subscriber on joint_trajectory"); return
        for _ in range(10):
            self.traj_pub.publish(jt)
            rclpy.spin_once(self, timeout_sec=0.1)
        # keep alive so the message is delivered + motion starts
        end = self.get_clock().now()
        while (self.get_clock().now() - end).nanoseconds < 2e9:
            rclpy.spin_once(self, timeout_sec=0.1)
        self.get_logger().info("trajectory sent to arm_controller")


def main():
    rclpy.init()
    n = Pick3()
    sol = n.solve()
    if sol is not None:
        n.execute(sol)
    n.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
