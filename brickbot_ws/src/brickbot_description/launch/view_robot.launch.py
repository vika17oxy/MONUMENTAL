"""Visualize BrickBot URDF in RViz with joint-state sliders."""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    prefix = LaunchConfiguration('prefix')
    tool = LaunchConfiguration('tool')

    pkg = FindPackageShare('brickbot_description')
    xacro_file = PathJoinSubstitution([pkg, 'urdf', 'brickbot.urdf.xacro'])

    robot_description = {
        'robot_description': Command([
            'xacro ', xacro_file,
            ' prefix:=', prefix,
            ' tool:=', tool,
        ])
    }

    return LaunchDescription([
        DeclareLaunchArgument('prefix', default_value=''),
        DeclareLaunchArgument('tool', default_value='gripper'),
        Node(package='robot_state_publisher', executable='robot_state_publisher',
             parameters=[robot_description]),
        Node(package='joint_state_publisher_gui', executable='joint_state_publisher_gui'),
        Node(package='rviz2', executable='rviz2',
             arguments=['-d', PathJoinSubstitution([pkg, 'rviz', 'view_robot.rviz'])]),
    ])
