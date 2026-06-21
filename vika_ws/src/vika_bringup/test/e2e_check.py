#!/usr/bin/env python3
"""End-to-end smoke checks against a RUNNING VIKA simulation.

Verifies the live system is healthy after `./start-docker.sh`:
  * both robots publish joint_states (6 arm joints + rail), values finite,
  * no joint has collapsed past its limit (arm is held, not drooping),
  * the MoveIt /compute_ik service is available (move_group up),
  * TF world -> <robot>_arm_tcp resolves (FK chain intact).

Run inside the container with the sim up:
    python3 /ws/src/vika_bringup/test/e2e_check.py
Exit code 0 = all checks passed.
"""
import math
import sys
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import JointState
import tf2_ros

ARM_LIMITS = {  # rough joint ranges from arm_6dof.xacro (rad)
    1: 3.2, 2: 2.8, 3: 2.8, 4: 6.2, 5: 2.4, 6: 6.2,
}


class E2E(Node):
    def __init__(self):
        super().__init__("e2e_check")
        self.js = {}
        for r in ("robot_a", "robot_b"):
            self.create_subscription(
                JointState, f"/{r}/joint_states",
                lambda m, r=r: self.js.__setitem__(r, m), 10)
        self.tf = tf2_ros.Buffer()
        tf2_ros.TransformListener(self.tf, self)

    def spin(self, secs):
        end = self.get_clock().now()
        while (self.get_clock().now() - end).nanoseconds < secs * 1e9:
            rclpy.spin_once(self, timeout_sec=0.1)


def main():
    rclpy.init()
    n = E2E()
    n.spin(4.0)               # collect joint_states + TF
    fails = []

    def check(name, ok, detail=""):
        print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
        if not ok:
            fails.append(name)

    for r in ("robot_a", "robot_b"):
        msg = n.js.get(r)
        check(f"{r}: joint_states published", msg is not None)
        if not msg:
            continue
        m = dict(zip(msg.name, msg.position))
        check(f"{r}: has rail joint", f"{r}_rail_joint" in m)
        finite = all(math.isfinite(v) for v in msg.position)
        check(f"{r}: all joint values finite", finite)
        held = True
        for i, lim in ARM_LIMITS.items():
            v = m.get(f"{r}_arm_j{i}")
            if v is not None and abs(v) > lim + 0.2:
                held = False
        check(f"{r}: arm within limits (not collapsed)", held)

    # MoveIt IK service (move_group up)
    have_ik = "/compute_ik" in dict(n.get_service_names_and_types())
    check("move_group /compute_ik available", have_ik)

    # FK chain via TF
    for r in ("robot_a", "robot_b"):
        try:
            n.tf.lookup_transform("world", f"{r}_arm_tcp", rclpy.time.Time())
            ok = True
        except Exception:
            ok = False
        check(f"{r}: TF world->{r}_arm_tcp resolves", ok)

    n.destroy_node()
    rclpy.shutdown()
    print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED: ' + ', '.join(fails)}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
