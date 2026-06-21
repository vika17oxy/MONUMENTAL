"""MoveIt Servo for robot_a (VIKA 6) — real-time Cartesian / joint jogging.

Streams twist (/servo_node/delta_twist_cmds) or joint (/servo_node/delta_joint_cmds)
commands into smooth motion on the live arm_controller. Enable once after launch:
    ros2 service call /servo_node/start_servo std_srvs/srv/Trigger
(start-docker.sh does this automatically.)
"""
import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch_ros.actions import Node
from launch_param_builder import ParameterBuilder
from moveit_configs_utils import MoveItConfigsBuilder


def generate_launch_description():
    desc_share = get_package_share_directory("vika_description")
    urdf_xacro = os.path.join(desc_share, "urdf", "vika.urdf.xacro")

    moveit_config = (
        MoveItConfigsBuilder("vika", package_name="vika_moveit")
        .robot_description(
            file_path=urdf_xacro,
            mappings={"prefix": "robot_a_", "tool": "gripper",
                      "ns": "robot_a", "arm": "true", "base_x": "-2"},
        )
        .robot_description_semantic(file_path="config/robot_a.srdf")
        .robot_description_kinematics(file_path="config/robot_a_kinematics.yaml")
        .joint_limits(file_path="config/robot_a_joint_limits.yaml")
        .to_moveit_configs()
    )

    servo_params = {
        "moveit_servo": ParameterBuilder("vika_moveit")
        .yaml("config/robot_a_servo.yaml")
        .to_dict()
    }

    servo_node = Node(
        package="moveit_servo",
        executable="servo_node",
        name="servo_node",
        output="screen",
        parameters=[
            servo_params,
            moveit_config.robot_description,
            moveit_config.robot_description_semantic,
            moveit_config.robot_description_kinematics,
            {"use_sim_time": True},
            # required by the AccelerationLimitedPlugin smoother
            {"update_period": 0.02},
            {"planning_group_name": "arm"},
        ],
    )

    return LaunchDescription([servo_node])
