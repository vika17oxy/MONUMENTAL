"""Spawn a single VIKA into the running Gazebo world.

Usage:
    ros2 launch vika_gazebo spawn_robot.launch.py name:=robot_a tool:=gripper x:=0 y:=0

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
    base_x = LaunchConfiguration('base_x')
    base_yaw = LaunchConfiguration('base_yaw')

    xacro = PathJoinSubstitution([
        FindPackageShare('vika_description'), 'urdf', 'vika.urdf.xacro'
    ])
    # World placement is baked into the URDF (base_x/base_yaw), NOT the spawn
    # pose — the world-fixed rail ignores the create -x/-y/-Y.
    desc = ParameterValue(
        Command(['xacro ', xacro, ' prefix:=', prefix, ' tool:=', tool,
                 ' ns:=', name, ' arm:=true',
                 ' base_x:=', base_x, ' base_yaw:=', base_yaw]),
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
            # gz display label (decoupled from the namespace `name`) so the model
            # tree shows VIKA_5 / VIKA_6 while topics/TF stay robot_a/robot_b.
            '-name', LaunchConfiguration('display'),
            '-x', '0.0', '-y', '0.0', '-z', '0.0',
        ],
        output='screen',
    )

    return LaunchDescription([
        DeclareLaunchArgument('name',   default_value='robot_a'),
        DeclareLaunchArgument('display', default_value='robot_a'),
        DeclareLaunchArgument('prefix', default_value='robot_a_'),
        DeclareLaunchArgument('tool',   default_value='gripper'),
        DeclareLaunchArgument('base_x',   default_value='0.0'),
        DeclareLaunchArgument('base_yaw', default_value='0.0'),
        rsp,
        spawn,
    ])
