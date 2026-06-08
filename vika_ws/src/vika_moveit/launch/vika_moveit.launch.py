"""RViz + MoveIt for the MCP-built vika URDF (base + 6 links + gripper).
Mock hardware (mock_components/GenericSystem) — no Gazebo.
"""
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    desc_share = get_package_share_directory("vika_description")
    moveit_share = get_package_share_directory("vika_moveit")

    urdf_xacro = os.path.join(desc_share, "urdf", "base_only.urdf.xacro")

    moveit_config = (
        MoveItConfigsBuilder("vika_step", package_name="vika_moveit")
        .robot_description(file_path=urdf_xacro)
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

    controllers_yaml = os.path.join(moveit_share, "config", "vika_ros2_controllers.yaml")
    rviz_config = os.path.join(moveit_share, "config", "moveit.rviz")

    rsp = Node(package="robot_state_publisher", executable="robot_state_publisher",
               output="screen", parameters=[moveit_config.robot_description])

    ros2_control_node = Node(package="controller_manager", executable="ros2_control_node",
                              output="screen",
                              parameters=[moveit_config.robot_description, controllers_yaml])

    spawn_jsb = Node(package="controller_manager", executable="spawner",
                     arguments=["joint_state_broadcaster", "--controller-manager", "/controller_manager"])

    spawn_arm = Node(package="controller_manager", executable="spawner",
                     arguments=["arm_controller", "--controller-manager", "/controller_manager"])

    move_group = Node(package="moveit_ros_move_group", executable="move_group",
                      output="screen", parameters=[moveit_config.to_dict()])

    rviz = Node(package="rviz2", executable="rviz2", output="screen",
                arguments=["-d", rviz_config],
                parameters=[
                    moveit_config.robot_description,
                    moveit_config.robot_description_semantic,
                    moveit_config.robot_description_kinematics,
                    moveit_config.planning_pipelines,
                    moveit_config.joint_limits,
                ])

    return LaunchDescription([rsp, ros2_control_node, spawn_jsb, spawn_arm, move_group, rviz])
