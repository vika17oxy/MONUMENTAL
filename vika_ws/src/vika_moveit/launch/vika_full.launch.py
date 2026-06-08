"""Full integration: spawn robot in NATIVE Gazebo + MoveIt + RViz.

Prerequisites:
  - Native Gazebo already running with construction_site world
    (started via scripts/start-gazebo.sh, GZ_PARTITION=vika)
  - ROS_DOMAIN_ID=42 matches between this docker container and native gz sim
"""
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.substitutions import Command, FindExecutable, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue
from launch_ros.substitutions import FindPackageShare
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    desc_share = get_package_share_directory("vika_description")
    moveit_share = get_package_share_directory("vika_moveit")
    urdf_xacro = os.path.join(desc_share, "urdf", "base_only.urdf.xacro")

    moveit_config = (
        MoveItConfigsBuilder("vika_step", package_name="vika_moveit")
        .robot_description(file_path=urdf_xacro, mappings={"sim_mode": "gazebo"})
        .robot_description_semantic(file_path="config/vika.srdf")
        .robot_description_kinematics(file_path="config/vika_kinematics.yaml")
        .joint_limits(file_path="config/vika_joint_limits.yaml")
        .trajectory_execution(file_path="config/vika_moveit_controllers.yaml")
        .planning_pipelines(pipelines=["ompl"])
        .planning_scene_monitor(
            publish_robot_description=True,
            publish_robot_description_semantic=True,
        )
        .to_moveit_configs()
    )

    rviz_config = os.path.join(moveit_share, "config", "moveit.rviz")

    rsp = Node(package="robot_state_publisher", executable="robot_state_publisher",
               output="screen", parameters=[moveit_config.robot_description, {"use_sim_time": True}])

    # Bridge /clock from Gazebo to ROS so use_sim_time works
    clock_bridge = Node(
        package="ros_gz_bridge", executable="parameter_bridge",
        arguments=["/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock"],
        output="screen",
    )

    # Spawn the URDF into the running Gazebo world
    spawn = Node(
        package="ros_gz_sim", executable="create",
        arguments=[
            "-name", "vika",
            "-topic", "/robot_description",
            "-x", "0", "-y", "0", "-z", "0.0",
        ],
        output="screen",
    )

    # ===== Second robot (visual twin "vika_5") =====
    # Process the xacro and post-process to prefix all link/joint names with "vika_5_".
    # That way both robots have unique TF frames and can both render in RViz.
    import subprocess, re
    proc = subprocess.run(
        ["xacro", urdf_xacro, "sim_mode:=passive",
         "ee_mesh:=nozzle.stl",
         "ee_rpy:=0 0 -0.7298"],
        capture_output=True, text=True, check=True,
    )
    twin_urdf = proc.stdout
    # Add vika_5_ prefix to every link/joint name reference, but skip frame_id="world"
    # and the "world" link itself (must remain shared anchor).
    def _prefix(match):
        attr, val = match.group(1), match.group(2)
        if val == "world":
            return match.group(0)
        return f'{attr}="vika_5_{val}"'
    twin_urdf = re.sub(r'(?<![\w])(name|link|parent|child|reference)="([^"]+)"', _prefix, twin_urdf)

    # Make twin static in Gazebo so it doesn't collapse under gravity
    # (twin has no controllers; without <static>true</static> joints fall).
    # Inject <gazebo><static>true</static></gazebo> just before </robot>.
    twin_urdf = twin_urdf.replace(
        "</robot>",
        "  <gazebo><static>true</static></gazebo>\n</robot>",
    )

    spawn_b_pub = Node(
        package="robot_state_publisher", executable="robot_state_publisher",
        namespace="vika_5",
        parameters=[{"robot_description": twin_urdf, "use_sim_time": True}],
        remappings=[("tf", "/tf"), ("tf_static", "/tf_static")],
    )
    # Twin has no controller → publish all-zero joint states for it
    spawn_b_jsp = Node(
        package="joint_state_publisher", executable="joint_state_publisher",
        namespace="vika_5",
        parameters=[{"robot_description": twin_urdf,
                     "rate": 30,
                     "publish_default_positions": True}],
    )
    spawn_b = Node(
        package="ros_gz_sim", executable="create",
        arguments=[
            "-name", "vika_5",
            "-topic", "/vika_5/robot_description",
            "-x", "0", "-y", "-2.0", "-z", "0.0",
        ],
        output="screen",
    )

    # gz_ros2_control plugin inside Gazebo runs the controller_manager itself.
    # We just need to load+activate the controllers via spawner.
    spawn_jsb = Node(package="controller_manager", executable="spawner",
                     arguments=["joint_state_broadcaster", "--controller-manager", "/controller_manager"])
    spawn_arm = Node(package="controller_manager", executable="spawner",
                     arguments=["arm_controller", "--controller-manager", "/controller_manager"])

    move_group = Node(package="moveit_ros_move_group", executable="move_group",
                      output="screen",
                      respawn=True, respawn_delay=2.0,
                      parameters=[moveit_config.to_dict(), {"use_sim_time": True}])

    rviz = Node(package="rviz2", executable="rviz2", output="screen",
                arguments=["-d", rviz_config],
                parameters=[
                    moveit_config.robot_description,
                    moveit_config.robot_description_semantic,
                    moveit_config.robot_description_kinematics,
                    moveit_config.planning_pipelines,
                    moveit_config.joint_limits,
                    {"use_sim_time": True},
                ])

    # Auto-publish pallet + bricks as collision objects 5s after launch
    from launch.actions import TimerAction
    scene_publisher = TimerAction(
        period=5.0,
        actions=[Node(package="vika_moveit", executable="publish_scene.py",
                      output="screen", parameters=[{"use_sim_time": True}])],
    )

    # rosbridge WebSocket server (port 9090) for HMI ↔ ROS communication
    rosbridge = Node(
        package="rosbridge_server", executable="rosbridge_websocket",
        name="rosbridge_websocket",
        parameters=[{"port": 9090, "use_sim_time": True}],
        output="screen",
    )

    # HMI jog bridge: translates /hmi/cmd (HOME / joint nudges) into
    # JointTrajectoryController commands so the dashboard can drive the robot.
    hmi_bridge = Node(
        package="vika_moveit", executable="hmi_bridge.py",
        output="screen", parameters=[{"use_sim_time": True}],
    )

    return LaunchDescription([
        clock_bridge,
        rsp,
        spawn,
        spawn_b_pub,
        spawn_b_jsp,
        spawn_b,
        spawn_jsb,
        spawn_arm,
        move_group,
        rviz,
        scene_publisher,
        rosbridge,
        hmi_bridge,
    ])
