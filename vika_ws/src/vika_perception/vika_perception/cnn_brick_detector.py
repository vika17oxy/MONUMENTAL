"""YOLOv8 brick pose detector (stub).

Subscribes to the wrist RGBD camera image and publishes Detection3DArray.
Replace the dummy pipeline with ultralytics inference + 3D back-projection.
"""
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Image
from vision_msgs.msg import Detection3DArray


class CnnBrickDetector(Node):
    def __init__(self) -> None:
        super().__init__('cnn_brick_detector')
        self.declare_parameter('image_topic', '/robot_b/wrist_camera/image_raw')
        self.declare_parameter('model_path', '')

        topic = self.get_parameter('image_topic').value
        self.sub = self.create_subscription(Image, topic, self.on_image, 10)
        self.pub = self.create_publisher(Detection3DArray, '/perception/detections', 10)
        self.get_logger().info(f'listening on {topic}')

    def on_image(self, msg: Image) -> None:
        # TODO: YOLOv8 inference + depth-based 3D pose
        out = Detection3DArray()
        out.header = msg.header
        self.pub.publish(out)


def main() -> None:
    rclpy.init()
    rclpy.spin(CnnBrickDetector())
    rclpy.shutdown()


if __name__ == '__main__':
    main()
