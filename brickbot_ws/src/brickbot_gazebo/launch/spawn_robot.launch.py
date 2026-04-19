"""Spawn a single BrickBot into the running Gazebo world.

Usage:
    ros2 launch brickbot_gazebo spawn_robot.launch.py prefix:=robot_a_ x:=0 y:=0

Can be called multiple times for robot_a, robot_b.
"""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    prefix = LaunchConfiguration('prefix')
    tool = LaunchConfiguration('tool')
    x = LaunchConfiguration('x')
    y = LaunchConfiguration('y')

    xacro = PathJoinSubstitution([
        FindPackageShare('brickbot_description'), 'urdf', 'brickbot.urdf.xacro'
    ])
    desc = Command(['xacro ', xacro, ' prefix:=', prefix, ' tool:=', tool])

    rsp = Node(
        package='robot_state_publisher', executable='robot_state_publisher',
        namespace=prefix,
        parameters=[{'robot_description': desc}],
        output='screen',
    )

    spawn = Node(
        package='ros_gz_sim', executable='create',
        arguments=[
            '-string', desc,
            '-name', prefix,
            '-x', x, '-y', y, '-z', '0.3',
        ],
        output='screen',
    )

    return LaunchDescription([
        DeclareLaunchArgument('prefix', default_value='robot_a_'),
        DeclareLaunchArgument('tool',   default_value='gripper'),
        DeclareLaunchArgument('x',      default_value='0.0'),
        DeclareLaunchArgument('y',      default_value='0.0'),
        rsp,
        spawn,
    ])
