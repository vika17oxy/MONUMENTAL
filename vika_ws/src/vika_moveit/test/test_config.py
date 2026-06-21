#!/usr/bin/env python3
"""Unit tests for the VIKA MoveIt + ros2_control configuration.

Validate the static config (SRDF, kinematics, controllers) without launching
move_group — well-formed XML/YAML and the expected groups/joints/controllers.

Run:  python3 -m pytest vika_ws/src/vika_moveit/test/test_config.py
"""
import os
import xml.etree.ElementTree as ET
import yaml
import pytest

MOVEIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CTRL = os.path.normpath(os.path.join(MOVEIT, "..", "vika_control", "config"))


def cfg(*parts):
    return os.path.join(MOVEIT, "config", *parts)


# ----- SRDF ------------------------------------------------------------------
@pytest.fixture(scope="module")
def srdf():
    return ET.parse(cfg("robot_a.srdf")).getroot()


def test_srdf_wellformed(srdf):
    assert srdf.tag == "robot"


def test_srdf_arm_group_chain(srdf):
    arm = [g for g in srdf.findall("group") if g.get("name") == "arm"]
    assert arm, "no planning group 'arm'"
    chain = arm[0].find("chain")
    assert chain is not None
    assert chain.get("base_link") == "robot_a_arm_base_link"
    assert chain.get("tip_link") == "robot_a_arm_tcp"


def test_srdf_has_end_effector(srdf):
    ee = srdf.findall("end_effector")
    assert ee and ee[0].get("parent_link") == "robot_a_arm_tool0"


def test_srdf_self_collisions_disabled(srdf):
    """Coarse primitive collision -> self-collision must be fully disabled."""
    dis = srdf.findall("disable_collisions")
    assert len(dis) >= 30, "expected the full self-collision disable matrix"


# ----- kinematics ------------------------------------------------------------
def test_kinematics_yaml_valid():
    k = yaml.safe_load(open(cfg("robot_a_kinematics.yaml")))
    assert "arm" in k
    assert "kdl" in k["arm"]["kinematics_solver"].lower()


def test_joint_limits_yaml_valid():
    j = yaml.safe_load(open(cfg("robot_a_joint_limits.yaml")))
    jl = j["joint_limits"]
    for i in range(1, 7):
        name = f"robot_a_arm_j{i}"
        assert name in jl
        assert jl[name]["has_velocity_limits"] is True


def test_moveit_controllers_point_to_namespaced_action():
    m = yaml.safe_load(open(cfg("robot_a_moveit_controllers.yaml")))
    names = m["moveit_simple_controller_manager"]["controller_names"]
    assert "/robot_a/arm_controller" in names


# ----- ros2_control controllers (vika_control) -------------------------------
@pytest.mark.parametrize("robot,tool_ctrl", [
    ("robot_a", "gripper_controller"),   # gripper -> vacuum: no joint ctrl (see note)
    ("robot_b", "cement_controller"),
])
def test_controllers_yaml_valid(robot, tool_ctrl):
    path = os.path.join(CTRL, f"controllers_{robot}.yaml")
    c = yaml.safe_load(open(path))
    cm = c[f"/{robot}/controller_manager"]["ros__parameters"]
    assert "joint_state_broadcaster" in cm
    assert "arm_controller" in cm
    assert "rail_controller" in cm
    arm = c[f"/{robot}/arm_controller"]["ros__parameters"]["joints"]
    assert arm == [f"{robot}_arm_j{i}" for i in range(1, 7)]


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
