"""RViz + MoveIt for the standalone 6-DOF arm. No Gazebo.

Hardware: ros2_control mock_components/GenericSystem (in URDF).
Controllers: joint_state_broadcaster + arm_controller (JointTrajectoryController).
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    description_share = get_package_share_directory("vika_description")
    moveit_share = get_package_share_directory("vika_moveit")

    urdf_xacro = os.path.join(
        description_share, "urdf", "arm_standalone_moveit.urdf.xacro"
    )

    moveit_config = (
        MoveItConfigsBuilder("arm_standalone", package_name="vika_moveit")
        .robot_description(file_path=urdf_xacro)
        .robot_description_semantic(file_path="config/arm_standalone.srdf")
        .robot_description_kinematics(file_path="config/kinematics.yaml")
        .joint_limits(file_path="config/joint_limits.yaml")
        .trajectory_execution(file_path="config/moveit_controllers.yaml")
        .planning_pipelines(pipelines=["ompl"])
        .planning_scene_monitor(
            publish_robot_description=True,
            publish_robot_description_semantic=True,
        )
        .to_moveit_configs()
    )

    controllers_yaml = os.path.join(moveit_share, "config", "ros2_controllers.yaml")
    rviz_config = os.path.join(moveit_share, "config", "moveit.rviz")

    rsp = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        output="screen",
        parameters=[moveit_config.robot_description],
    )

    ros2_control_node = Node(
        package="controller_manager",
        executable="ros2_control_node",
        output="screen",
        parameters=[moveit_config.robot_description, controllers_yaml],
    )

    spawn_jsb = Node(
        package="controller_manager",
        executable="spawner",
        arguments=["joint_state_broadcaster", "--controller-manager", "/controller_manager"],
    )

    spawn_arm = Node(
        package="controller_manager",
        executable="spawner",
        arguments=["arm_controller", "--controller-manager", "/controller_manager"],
    )

    move_group = Node(
        package="moveit_ros_move_group",
        executable="move_group",
        output="screen",
        parameters=[moveit_config.to_dict()],
    )

    rviz = Node(
        package="rviz2",
        executable="rviz2",
        output="screen",
        arguments=["-d", rviz_config],
        parameters=[
            moveit_config.robot_description,
            moveit_config.robot_description_semantic,
            moveit_config.robot_description_kinematics,
            moveit_config.planning_pipelines,
            moveit_config.joint_limits,
        ],
    )

    return LaunchDescription([
        rsp,
        ros2_control_node,
        spawn_jsb,
        spawn_arm,
        move_group,
        rviz,
    ])
