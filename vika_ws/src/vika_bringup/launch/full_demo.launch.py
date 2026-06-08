"""
VIKA ROS stack (Gazebo runs natively in WSL2, not here).

- Spawns robot_a (gripper) and robot_b (cement) into the already-running world
- Starts ros_gz_bridge
- Loads ros2_control controllers per robot
- Starts rosbridge_server on :9090 for the web HMI
"""
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def spawn(name: str, tool: str, x: float, y: float):
    return IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([FindPackageShare('vika_gazebo'), 'launch', 'spawn_robot.launch.py'])
        ]),
        launch_arguments={
            'name': name, 'prefix': f'{name}_', 'tool': tool,
            'x': str(x), 'y': str(y),
        }.items(),
    )


def load_controller(name: str, namespace: str):
    return Node(
        package='controller_manager', executable='spawner',
        arguments=[name, '--controller-manager', f'/{namespace}/controller_manager'],
        output='screen',
    )


def generate_launch_description():
    bridge = Node(
        package='ros_gz_bridge', executable='parameter_bridge',
        parameters=[{'config_file': PathJoinSubstitution([
            FindPackageShare('vika_gazebo'), 'config', 'bridge.yaml'
        ])}],
        output='screen',
    )

    # rosbridge, MoveIt, mission, perception, MCP run in the Docker container —
    # not here. This launch file is for the native Gazebo-side stack only.

    return LaunchDescription([
        bridge,
        # Give native Gazebo a moment to be fully up before we try to spawn
        TimerAction(period=2.0, actions=[
            spawn('robot_a', 'gripper', 0.0, -1.5),
            spawn('robot_b', 'cement',  0.0,  1.5),
        ]),
        # ros2_control controllers disabled for Phase 2 — re-enable with MoveIt phase.
    ])
