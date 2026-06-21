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


def spawn(name: str, tool: str, base_x: float, base_yaw: float = 0.0, display: str = None):
    return IncludeLaunchDescription(
        PythonLaunchDescriptionSource([
            PathJoinSubstitution([FindPackageShare('vika_gazebo'), 'launch', 'spawn_robot.launch.py'])
        ]),
        launch_arguments={
            'name': name, 'prefix': f'{name}_', 'tool': tool,
            'display': display or name,    # gz model label (namespace stays `name`)
            'base_x': str(base_x), 'base_yaw': str(base_yaw),
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

    # Controllers come up via gz_ros2_control (the controller_manager runs inside
    # the gz server). Spawners load + activate them so every joint holds position
    # under gravity — this is what stops the robot from collapsing.
    def controllers(ns: str, tool_ctrl: str = None):
        names = ['joint_state_broadcaster', 'arm_controller', 'rail_controller']
        if tool_ctrl:
            names.append(tool_ctrl)
        return [load_controller(n, ns) for n in names]

    return LaunchDescription([
        bridge,
        # Give native Gazebo a moment to be fully up before we try to spawn
        # Robots face each other across X: robot_a on the -X side looking +X,
        # robot_b on the +X side looking -X (yaw=pi). Each rides a 12.5 m rail
        # along Y. The wall is built along Y between them.
        TimerAction(period=2.0, actions=[
            spawn('robot_a', 'gripper', base_x=-2.0, base_yaw=0.0,     display='VIKA_6'),
            spawn('robot_b', 'cement',  base_x=0.8,  base_yaw=3.14159, display='VIKA_5'),
        ]),
        # Wait for the gz_ros2_control plugin to start each controller_manager.
        TimerAction(period=8.0, actions=[
            *controllers('robot_a'),  # vacuum gripper: no actuated joint
            *controllers('robot_b', 'cement_controller'),
        ]),
    ])
