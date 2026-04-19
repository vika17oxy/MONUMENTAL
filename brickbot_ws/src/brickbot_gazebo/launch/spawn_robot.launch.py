"""Spawn a single BrickBot into the running Gazebo world.

Usage:
    ros2 launch brickbot_gazebo spawn_robot.launch.py name:=robot_a tool:=gripper x:=0 y:=0

Can be called multiple times for robot_a, robot_b.
"""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    name = LaunchConfiguration('name')        # e.g. robot_a
    prefix = LaunchConfiguration('prefix')    # xacro link/joint prefix, e.g. robot_a_
    tool = LaunchConfiguration('tool')
    x = LaunchConfiguration('x')
    y = LaunchConfiguration('y')

    xacro = PathJoinSubstitution([
        FindPackageShare('brickbot_description'), 'urdf', 'brickbot.urdf.xacro'
    ])
    desc = ParameterValue(
        Command(['xacro ', xacro, ' prefix:=', prefix, ' tool:=', tool, ' ns:=', name]),
        value_type=str,
    )

    rsp = Node(
        package='robot_state_publisher', executable='robot_state_publisher',
        namespace=name,
        parameters=[{'robot_description': desc}],
        output='screen',
    )

    spawn = Node(
        package='ros_gz_sim', executable='create',
        arguments=[
            '-topic', ['/', name, '/robot_description'],
            '-name', name,
            '-x', x, '-y', y, '-z', '0.3',
        ],
        output='screen',
    )

    return LaunchDescription([
        DeclareLaunchArgument('name',   default_value='robot_a'),
        DeclareLaunchArgument('prefix', default_value='robot_a_'),
        DeclareLaunchArgument('tool',   default_value='gripper'),
        DeclareLaunchArgument('x',      default_value='0.0'),
        DeclareLaunchArgument('y',      default_value='0.0'),
        rsp,
        spawn,
    ])
