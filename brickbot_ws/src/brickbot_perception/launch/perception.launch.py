from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(package='brickbot_perception', executable='cnn_brick_detector',
             name='cnn_brick_detector', output='screen'),
    ])
