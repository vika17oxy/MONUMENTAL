"""
BrickBot full-stack launch.

- Starts Gazebo Harmonic with construction_site world
- Spawns robot_a (gripper) and robot_b (cement) via ros_gz_sim create
- Starts ros_gz_bridge
- Loads ros2_control controllers per robot
- Starts rosbridge_server on :9090 for the web HMI
"""
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, ExecuteProcess, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def spawn(prefix: str, tool: str, x: float, y: float):
    return IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([FindPackageShare('brickbot_gazebo'), 'launch', 'spawn_robot.launch.py'])
        ]),
        launch_arguments={'prefix': prefix, 'tool': tool, 'x': str(x), 'y': str(y)}.items(),
    )


def load_controller(name: str, namespace: str):
    return ExecuteProcess(
        cmd=['ros2', 'run', 'controller_manager', 'spawner', name,
             '--controller-manager', f'/{namespace}/controller_manager'],
        output='screen',
    )


def generate_launch_description():
    gz_sim = IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([FindPackageShare('ros_gz_sim'), 'launch', 'gz_sim.launch.py'])
        ]),
        launch_arguments={
            'gz_args': ['-r ', PathJoinSubstitution([
                FindPackageShare('brickbot_gazebo'), 'worlds', 'construction_site.sdf'
            ])],
        }.items(),
    )

    bridge = Node(
        package='ros_gz_bridge', executable='parameter_bridge',
        parameters=[{'config_file': PathJoinSubstitution([
            FindPackageShare('brickbot_gazebo'), 'config', 'bridge.yaml'
        ])}],
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
        spawn('robot_a_', 'gripper', 0.0, -1.5),
        spawn('robot_b_', 'cement',  0.0,  1.5),
        TimerAction(period=5.0, actions=[
            load_controller('joint_state_broadcaster', 'robot_a'),
            load_controller('tracked_base_controller',  'robot_a'),
            load_controller('arm_controller',           'robot_a'),
            load_controller('joint_state_broadcaster', 'robot_b'),
            load_controller('tracked_base_controller',  'robot_b'),
            load_controller('arm_controller',           'robot_b'),
        ]),
        rosbridge,
    ])
