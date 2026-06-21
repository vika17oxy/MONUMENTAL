"""MoveIt move_group for the LIVE robot_a in Gazebo.

Plans for the 6-DOF arm (group "arm") and executes via the arm_controller that
already runs inside gz_ros2_control (/robot_a/arm_controller). No ros2_control
node is started here — Gazebo owns the controllers. The rail is NOT in the IK
group; its position is read from /robot_a/joint_states as a passive offset.
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
            # base_x/base_yaw MUST match how full_demo spawns robot_a, otherwise
            # move_group plans for an arm at the origin while the real arm is at
            # x=-2 -> every IK/plan result is offset by 2 m. This was the cause of
            # the TCP landing ~2 m off (and the contorted picks).
            mappings={"prefix": "robot_a_", "tool": "gripper",
                      "ns": "robot_a", "arm": "true", "base_x": "-2"},
        )
        .robot_description_semantic(file_path="config/robot_a.srdf")
        .robot_description_kinematics(file_path="config/robot_a_kinematics.yaml")
        .joint_limits(file_path="config/robot_a_joint_limits.yaml")
        .trajectory_execution(file_path="config/robot_a_moveit_controllers.yaml")
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
        output="screen",
        parameters=[moveit_config.to_dict(), {"use_sim_time": True}],
        # move_group's state monitor listens on /joint_states; the robot publishes
        # them under its namespace.
        remappings=[("/joint_states", "/robot_a/joint_states")],
    )

    return LaunchDescription([move_group])
