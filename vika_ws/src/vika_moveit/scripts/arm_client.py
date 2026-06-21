#!/usr/bin/env python3
"""Reusable arm client for the live VIKA robots.

Wraps the robust pattern learned the hard way:
  * IK via MoveIt /compute_ik, SEEDED with the current joint state and with
    avoid_collisions=True, so the solver returns a nearby, collision-free branch
    instead of wrist-flipped / self-colliding poses.
  * execution via the FollowJointTrajectory ACTION (goal handshake), not a topic
    publish (a single publish races discovery and is silently dropped).
  * current TCP pose from TF.

Used by pick3_lift.py and tcp_jog.py.
"""
import math
import rclpy
from rclpy.node import Node
from rclpy.action import ActionClient
from moveit_msgs.srv import GetPositionIK
from moveit_msgs.action import MoveGroup
from moveit_msgs.msg import Constraints, JointConstraint
from control_msgs.action import FollowJointTrajectory
from geometry_msgs.msg import PoseStamped
from trajectory_msgs.msg import JointTrajectory, JointTrajectoryPoint
from sensor_msgs.msg import JointState
from builtin_interfaces.msg import Duration
import tf2_ros


class ArmClient(Node):
    def __init__(self, robot="robot_a", group="arm", tip="robot_a_arm_tcp",
                 node_name="arm_client"):
        super().__init__(node_name)
        self.robot = robot
        self.group = group
        self.tip = tip
        self.joints = [f"{robot}_arm_j{i}" for i in range(1, 7)]
        self._js = {}
        self.create_subscription(JointState, f"/{robot}/joint_states",
                                 self._on_js, 10)
        self.ik = self.create_client(GetPositionIK, "/compute_ik")
        self.ac = ActionClient(
            self, FollowJointTrajectory,
            f"/{robot}/arm_controller/follow_joint_trajectory")
        # MoveGroup plan+execute (collision-free PATH, not just goal IK)
        self.mg = ActionClient(self, MoveGroup, "move_action")
        self.tf_buf = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buf, self)

    def _on_js(self, msg):
        for n, p in zip(msg.name, msg.position):
            self._js[n] = p

    def _spin(self, secs):
        end = self.get_clock().now()
        while (self.get_clock().now() - end).nanoseconds < secs * 1e9:
            rclpy.spin_once(self, timeout_sec=0.05)

    def wait_ready(self, timeout=20.0):
        self.ik.wait_for_service(timeout_sec=timeout)
        self.ac.wait_for_server(timeout_sec=timeout)
        t0 = self.get_clock().now()
        while len(self._js) < 6 and (self.get_clock().now() - t0).nanoseconds < timeout * 1e9:
            rclpy.spin_once(self, timeout_sec=0.1)
        return len(self._js) >= 6

    def current_joints(self):
        return [self._js.get(j, 0.0) for j in self.joints]

    def current_tcp(self, base="world"):
        """Return (xyz, quat) of the tip in `base`, or None."""
        for _ in range(50):
            rclpy.spin_once(self, timeout_sec=0.05)
            try:
                t = self.tf_buf.lookup_transform(base, self.tip, rclpy.time.Time())
                tr, ro = t.transform.translation, t.transform.rotation
                return ([tr.x, tr.y, tr.z], [ro.x, ro.y, ro.z, ro.w])
            except Exception:
                continue
        return None

    def solve_ik(self, xyz, quat, avoid_collisions=True, frame="world"):
        req = GetPositionIK.Request()
        r = req.ik_request
        r.group_name = self.group
        r.ik_link_name = self.tip
        r.avoid_collisions = avoid_collisions
        r.timeout = Duration(sec=2)
        # seed with the current state -> nearby, clean branch
        seed = JointState()
        seed.name = list(self.joints)
        seed.position = self.current_joints()
        r.robot_state.joint_state = seed
        ps = PoseStamped()
        ps.header.frame_id = frame
        ps.pose.position.x, ps.pose.position.y, ps.pose.position.z = xyz
        (ps.pose.orientation.x, ps.pose.orientation.y,
         ps.pose.orientation.z, ps.pose.orientation.w) = quat
        r.pose_stamped = ps
        fut = self.ik.call_async(req)
        rclpy.spin_until_future_complete(self, fut, timeout_sec=8.0)
        res = fut.result()
        if res is None or res.error_code.val != 1:
            code = None if res is None else res.error_code.val
            self.get_logger().warn(f"IK failed (code={code}) at {xyz}")
            return None
        sol = {n: p for n, p in zip(res.solution.joint_state.name,
                                    res.solution.joint_state.position)}
        return [sol[j] for j in self.joints]

    def move_joints(self, q, secs=4.0, wait=True):
        if not self.ac.wait_for_server(timeout_sec=10.0):
            self.get_logger().error("action server unavailable")
            return False
        pt = JointTrajectoryPoint()
        pt.positions = [float(x) for x in q]
        pt.time_from_start = Duration(sec=int(secs),
                                      nanosec=int((secs % 1) * 1e9))
        goal = FollowJointTrajectory.Goal()
        goal.trajectory = JointTrajectory(joint_names=list(self.joints), points=[pt])
        gf = self.ac.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, gf, timeout_sec=10.0)
        gh = gf.result()
        if gh is None or not gh.accepted:
            self.get_logger().error("goal rejected")
            return False
        if wait:
            rf = gh.get_result_async()
            rclpy.spin_until_future_complete(self, rf, timeout_sec=secs + 8.0)
        return True

    def plan_move_joints(self, q, vel=0.3, acc=0.3, plan_time=5.0):
        """Plan a COLLISION-FREE path to joint goal q via MoveGroup and execute.
        Unlike move_joints (raw JTC, no path checking), MoveIt validates the
        whole trajectory against self/scene collisions before executing."""
        if not self.mg.wait_for_server(timeout_sec=15.0):
            self.get_logger().error("move_action server unavailable")
            return False
        goal = MoveGroup.Goal()
        req = goal.request
        req.group_name = self.group
        req.num_planning_attempts = 10
        req.allowed_planning_time = plan_time
        req.max_velocity_scaling_factor = vel
        req.max_acceleration_scaling_factor = acc
        c = Constraints()
        for name, pos in zip(self.joints, q):
            c.joint_constraints.append(JointConstraint(
                joint_name=name, position=float(pos),
                tolerance_above=0.01, tolerance_below=0.01, weight=1.0))
        req.goal_constraints = [c]
        goal.planning_options.plan_only = False
        gf = self.mg.send_goal_async(goal)
        rclpy.spin_until_future_complete(self, gf, timeout_sec=15.0)
        gh = gf.result()
        if gh is None or not gh.accepted:
            self.get_logger().error("MoveGroup goal rejected")
            return False
        rf = gh.get_result_async()
        rclpy.spin_until_future_complete(self, rf, timeout_sec=plan_time + 20.0)
        res = rf.result()
        code = res.result.error_code.val if res else None
        ok = code == 1
        if not ok:
            self.get_logger().warn(f"MoveGroup planning/exec failed (code={code})")
        return ok

    def move_to_pose(self, xyz, quat, secs=4.0, avoid_collisions=True, plan=True):
        q = self.solve_ik(xyz, quat, avoid_collisions=avoid_collisions)
        if q is None:
            return False
        if plan:
            return self.plan_move_joints(q)
        return self.move_joints(q, secs=secs)
