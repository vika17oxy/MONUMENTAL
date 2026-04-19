"""
BrickBot full-stack launch.

Starts:
  - Gazebo Harmonic with construction_site world
  - ros_gz_bridge (topics from config/bridge.yaml)
  - robot_state_publisher for both robots (robot_a = gripper, robot_b = cement)
  - rosbridge_server on :9090 for the web HMI
"""
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, ExecuteProcess
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import Command, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def rsp(prefix: str, tool: str, node_name: str):
    xacro = PathJoinSubstitution([
        FindPackageShare('brickbot_description'), 'urdf', 'brickbot.urdf.xacro'
    ])
    desc = {'robot_description': Command([
        'xacro ', xacro, ' prefix:=', prefix, ' tool:=', tool,
    ])}
    return Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        name=node_name,
        namespace=prefix.rstrip('_'),
        parameters=[desc],
        output='screen',
    )


def generate_launch_description():
    gz_sim = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([FindPackageShare('ros_gz_sim'), 'launch', 'gz_sim.launch.py'])
        ]),
        launch_arguments={
            'gz_args': [
                '-r ',
                PathJoinSubstitution([
                    FindPackageShare('brickbot_gazebo'), 'worlds', 'construction_site.sdf'
                ]),
            ],
        }.items(),
    )

    bridge = Node(
        package='ros_gz_bridge',
        executable='parameter_bridge',
        parameters=[{
            'config_file': PathJoinSubstitution([
                FindPackageShare('brickbot_gazebo'), 'config', 'bridge.yaml'
            ]),
        }],
        output='screen',
    )

    rosbridge = ExecuteProcess(
        cmd=['ros2', 'launch', 'rosbridge_server', 'rosbridge_websocket_launch.xml',
             'port:=9090'],
        output='screen',
    )

    return LaunchDescription([
        gz_sim,
        bridge,
        rsp('robot_a_', 'gripper', 'rsp_a'),
        rsp('robot_b_', 'cement',  'rsp_b'),
        rosbridge,
    ])
