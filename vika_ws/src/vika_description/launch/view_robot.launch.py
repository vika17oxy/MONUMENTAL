"""Visualize VIKA URDF in RViz with joint-state sliders."""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, Command, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare


def generate_launch_description():
    prefix = LaunchConfiguration('prefix')
    tool = LaunchConfiguration('tool')
    arm = LaunchConfiguration('arm')

    pkg = FindPackageShare('vika_description')
    xacro_file = PathJoinSubstitution([pkg, 'urdf', 'vika.urdf.xacro'])

    robot_description = {
        'robot_description': ParameterValue(
            Command([
                'xacro ', xacro_file,
                ' prefix:=', prefix,
                ' tool:=', tool,
                ' arm:=', arm,
            ]),
            value_type=str,
        )
    }

    return LaunchDescription([
        DeclareLaunchArgument('prefix', default_value=''),
        DeclareLaunchArgument('tool', default_value='gripper'),
        DeclareLaunchArgument('arm', default_value='true'),
        Node(package='robot_state_publisher', executable='robot_state_publisher',
             parameters=[robot_description]),
        Node(package='joint_state_publisher_gui', executable='joint_state_publisher_gui',
             parameters=[robot_description]),
        Node(package='rviz2', executable='rviz2',
             arguments=['-d', PathJoinSubstitution([pkg, 'rviz', 'view_robot.rviz'])]),
    ])
