"""Dual-arm MoveIt: one combined model with two independent planning groups.

Prerequisites:
  - Gazebo already running with the construction_site world (GZ_PARTITION=vika,
    GZ_SIM_SYSTEM_PLUGIN_PATH=/opt/ros/jazzy/lib so gz_ros2_control loads)
  - ROS_DOMAIN_ID=42

In RViz, pick the arm via the MotionPlanning "Planning Group" dropdown
(arm = robot A, arm_5 = robot B) and plan/execute each independently.
"""
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import TimerAction
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    desc_share = get_package_share_directory("vika_description")
    moveit_share = get_package_share_directory("vika_moveit")
    urdf_xacro = os.path.join(desc_share, "urdf", "vika_dual.urdf.xacro")

    moveit_config = (
        MoveItConfigsBuilder("vika_dual", package_name="vika_moveit")
        .robot_description(file_path=urdf_xacro, mappings={"sim_mode": "gazebo"})
        .robot_description_semantic(file_path="config/dual.srdf")
        .robot_description_kinematics(file_path="config/dual_kinematics.yaml")
        .joint_limits(file_path="config/dual_joint_limits.yaml")
        .trajectory_execution(file_path="config/dual_moveit_controllers.yaml")
        .planning_pipelines(pipelines=["ompl"])
        .planning_scene_monitor(
            publish_robot_description=True,
            publish_robot_description_semantic=True,
        )
        .to_moveit_configs()
    )

    rviz_config = os.path.join(moveit_share, "config", "moveit.rviz")

    rsp = Node(package="robot_state_publisher", executable="robot_state_publisher",
               output="screen",
               parameters=[moveit_config.robot_description, {"use_sim_time": True}])

    clock_bridge = Node(
        package="ros_gz_bridge", executable="parameter_bridge",
        arguments=["/clock@rosgraph_msgs/msg/Clock[gz.msgs.Clock"],
        output="screen",
    )

    spawn = Node(
        package="ros_gz_sim", executable="create",
        arguments=["-name", "vika_dual", "-topic", "/robot_description",
                   "-x", "0", "-y", "0", "-z", "0.0"],
        output="screen",
    )

    # gz_ros2_control runs the controller_manager inside Gazebo; load+activate all three.
    spawn_jsb = Node(package="controller_manager", executable="spawner",
                     arguments=["joint_state_broadcaster", "--controller-manager", "/controller_manager"])
    spawn_arm = Node(package="controller_manager", executable="spawner",
                     arguments=["arm_controller", "--controller-manager", "/controller_manager"])
    spawn_arm5 = Node(package="controller_manager", executable="spawner",
                      arguments=["arm_5_controller", "--controller-manager", "/controller_manager"])

    move_group = Node(package="moveit_ros_move_group", executable="move_group",
                      output="screen", respawn=True, respawn_delay=2.0,
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

    rosbridge = Node(
        package="rosbridge_server", executable="rosbridge_websocket",
        name="rosbridge_websocket",
        parameters=[{"port": 9090, "use_sim_time": True}],
        output="screen",
    )

    return LaunchDescription([
        clock_bridge, rsp, spawn,
        # give the spawn a moment so /controller_manager exists before spawners poll
        TimerAction(period=3.0, actions=[spawn_jsb, spawn_arm, spawn_arm5]),
        move_group, rviz, rosbridge,
    ])
