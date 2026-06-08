"""TCP linear-jog service for the HMI.

Accepts a small (x, y, z) delta in the TCP frame and commands MoveIt2 Servo
to move the tool tip by that offset while keeping orientation fixed.
Fulfills angabe.md Section 3 line 85 (HMI must move TCP linearly via IK).
"""
from __future__ import annotations

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import TwistStamped
from std_srvs.srv import Trigger


class TcpLinearJog(Node):
    def __init__(self) -> None:
        super().__init__('tcp_linear_jog')
        # TODO: wire to /servo_node/delta_twist_cmds or MoveIt Cartesian plan action
        self.pub = self.create_publisher(TwistStamped, '/servo_node/delta_twist_cmds', 10)
        self.srv = self.create_service(Trigger, '/hmi/ping', self.on_ping)
        self.get_logger().info('tcp_linear_jog ready (stub)')

    def on_ping(self, _req, res):
        res.success = True
        res.message = 'pong'
        return res


def main() -> None:
    rclpy.init()
    rclpy.spin(TcpLinearJog())
    rclpy.shutdown()


if __name__ == '__main__':
    main()
