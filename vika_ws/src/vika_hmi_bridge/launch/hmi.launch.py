from launch import LaunchDescription
from launch.actions import ExecuteProcess
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        ExecuteProcess(
            cmd=['ros2', 'launch', 'rosbridge_server',
                 'rosbridge_websocket_launch.xml', 'port:=9090'],
            output='screen',
        ),
        Node(package='web_video_server', executable='web_video_server',
             name='web_video_server', parameters=[{'port': 8080}]),
        Node(package='vika_hmi_bridge', executable='tcp_linear_jog',
             name='tcp_linear_jog', output='screen'),
    ])
