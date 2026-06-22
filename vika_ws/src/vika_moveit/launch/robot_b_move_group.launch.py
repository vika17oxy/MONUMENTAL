"""MoveIt move_group for the LIVE robot_b (cement nozzle) in Gazebo.

Mirrors robot_a's move_group but for robot_b: prefix robot_b_, tool=cement,
spawned at base_x=+2 / base_yaw=pi. The node runs in the `robot_b` namespace so
its action server is /robot_b/move_action (no clash with robot_a's /move_action)
and Cartesian planning is on /robot_b/compute_cartesian_path.
"""
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    desc_share = get_package_share_directory("vika_description")
    urdf_xacro = os.path.join(desc_share, "urdf", "vika.urdf.xacro")

    moveit_config = (
        MoveItConfigsBuilder("vika", package_name="vika_moveit")
        .robot_description(
            file_path=urdf_xacro,
            # MUST match how full_demo spawns robot_b (x=+0.8, yaw=pi) or every
            # IK/plan result is offset from the real arm. (Moving it closer to 0.3 made
            # the low-course nozzle-down pose UNreachable — self-collision/singularity —
            # so it's back at 0.8, the working distance.)
            mappings={"prefix": "robot_b_", "tool": "cement",
                      "ns": "robot_b", "arm": "true",
                      "base_x": "0.8", "base_yaw": "3.14159"},
        )
        .robot_description_semantic(file_path="config/robot_b.srdf")
        .robot_description_kinematics(file_path="config/robot_b_kinematics.yaml")
        .joint_limits(file_path="config/robot_b_joint_limits.yaml")
        .trajectory_execution(file_path="config/robot_b_moveit_controllers.yaml")
        .planning_pipelines(pipelines=["ompl"])
        .planning_scene_monitor(
            publish_robot_description=True,
            publish_robot_description_semantic=True,
        )
        .to_moveit_configs()
    )

    move_group = Node(
        package="moveit_ros_move_group",
        executable="move_group",
        namespace="robot_b",
        output="screen",
        parameters=[moveit_config.to_dict(), {"use_sim_time": True}],
        remappings=[("/joint_states", "/robot_b/joint_states")],
    )

    return LaunchDescription([move_group])
