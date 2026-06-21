#!/usr/bin/env python3
"""Console HMI: move a robot LINEARLY at the TCP (Cartesian jog via IK).

Satisfies the assignment requirement "the HMI must move one robot at the TCP
linearly (inverse kinematics required); a console application is the minimum".

Keeps the current TCP orientation fixed and translates the tool position by a
step, solving IK (seeded + collision-checked) and executing on the controller.

Usage:
  one-shot (scriptable / tests):
      tcp_jog.py x +0.1            # step TCP +0.1 m in world X
      tcp_jog.py z -0.05 --robot robot_a
  interactive:
      tcp_jog.py                   # then type:  x+ , x- , y+ , z- , q  (quit)
"""
import sys
import rclpy
sys.path.insert(0, "/ws/src/vika_moveit/scripts")
from arm_client import ArmClient  # noqa: E402

STEP = 0.05  # default interactive step (m)
AXIS = {"x": 0, "y": 1, "z": 2}
# A jog-ready pose: tool pointing straight down over the pallet. Jogging the
# fold/stow pose fails because its sideways orientation can't be held when
# translated, so the HMI homes to this reachable, gripper-down pose first.
READY_XYZ = (-0.6, 0.29, 0.7)
READY_QUAT = (0.70710678, 0.70710678, 0.0, 0.0)


def jog(arm, axis, delta, secs=2.5):
    cur = arm.current_tcp()
    if cur is None:
        arm.get_logger().error("no TCP pose (TF)")
        return False
    xyz, quat = cur
    xyz = list(xyz)
    xyz[AXIS[axis]] += delta
    ok = arm.move_to_pose(xyz, quat, secs=secs)
    tag = "OK" if ok else "FAIL"
    arm.get_logger().info(
        f"[{tag}] TCP {axis}{delta:+.3f} -> target "
        f"({xyz[0]:.3f}, {xyz[1]:.3f}, {xyz[2]:.3f})")
    return ok


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    robot = "robot_a"
    if "--robot" in sys.argv:
        robot = sys.argv[sys.argv.index("--robot") + 1]

    rclpy.init()
    arm = ArmClient(robot=robot, tip=f"{robot}_arm_tcp", node_name="tcp_jog")
    if not arm.wait_ready():
        arm.get_logger().error("arm not ready (IK/action/joint_states)")
        arm.destroy_node(); rclpy.shutdown(); return

    if args and args[0] == "ready":                 # one-shot: go to ready pose
        ok = arm.move_to_pose(READY_XYZ, READY_QUAT, secs=4.0)
        arm.get_logger().info(f"[{'OK' if ok else 'FAIL'}] ready pose")
    elif len(args) >= 2 and args[0] in AXIS:        # one-shot jog
        jog(arm, args[0], float(args[1]))
    else:                                           # interactive console
        arm.get_logger().info("homing to ready pose...")
        arm.move_to_pose(READY_XYZ, READY_QUAT, secs=4.0)
        print("TCP jog — commands: x+ x- y+ y- z+ z-  (q to quit), step=%.2fm" % STEP)
        try:
            for line in sys.stdin:
                c = line.strip().lower()
                if c in ("q", "quit", "exit"):
                    break
                if len(c) == 2 and c[0] in AXIS and c[1] in "+-":
                    jog(arm, c[0], STEP if c[1] == "+" else -STEP)
                else:
                    print("  ? use x+/x-/y+/y-/z+/z-/q")
        except (EOFError, KeyboardInterrupt):
            pass

    arm.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
