#!/usr/bin/env python3
"""Unit tests for the VIKA robot descriptions.

Parse the top-level xacro for both robots/tools and assert the resulting URDF is
well-formed and has the expected kinematic structure. Pure parsing — no Gazebo,
no ROS graph — so these run fast and deterministically.

Run:  python3 -m pytest vika_ws/src/vika_description/test/test_xacro.py
"""
import os
import subprocess
import xml.etree.ElementTree as ET
import pytest

PKG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XACRO = os.path.join(PKG, "urdf", "vika.urdf.xacro")


def run_xacro(**mappings):
    args = ["xacro", XACRO] + [f"{k}:={v}" for k, v in mappings.items()]
    out = subprocess.run(args, capture_output=True, text=True)
    assert out.returncode == 0, f"xacro failed: {out.stderr}"
    return ET.fromstring(out.stdout)


def joints_of(root, jtype=None):
    return [j for j in root.findall("joint")
            if jtype is None or j.get("type") == jtype]


def link_names(root):
    return {l.get("name") for l in root.findall("link")}


# ----- robot_a: 6-DOF arm + vacuum gripper -----------------------------------
@pytest.fixture(scope="module")
def robot_a():
    return run_xacro(prefix="robot_a_", tool="gripper", ns="robot_a",
                     arm="true", base_x="-2")


def test_robot_a_wellformed(robot_a):
    assert robot_a.tag == "robot"


def test_robot_a_six_revolute_arm_joints(robot_a):
    rev = [j.get("name") for j in joints_of(robot_a, "revolute")]
    for i in range(1, 7):
        assert f"robot_a_arm_j{i}" in rev
    assert len([n for n in rev if n.startswith("robot_a_arm_j")]) == 6


def test_robot_a_has_prismatic_rail(robot_a):
    pris = [j.get("name") for j in joints_of(robot_a, "prismatic")]
    assert "robot_a_rail_joint" in pris


def test_robot_a_dof_in_range(robot_a):
    """Assignment: 3..7 DOF. Arm group = 6 revolute (rail is separate)."""
    movable = joints_of(robot_a, "revolute") + joints_of(robot_a, "prismatic")
    arm = [j for j in movable if "arm_j" in j.get("name")]
    assert 3 <= len(arm) <= 7


def test_robot_a_vacuum_gripper_links(robot_a):
    names = link_names(robot_a)
    for pad in ("suction_pad_l", "suction_pad_c", "suction_pad_r"):
        assert f"robot_a_arm_{pad}" in names
    assert "robot_a_arm_tcp" in names          # TCP frame for IK
    assert "robot_a_arm_gripper_base" in names  # MoveIt/build_wall attach link


def test_robot_a_joint_limits_realistic(robot_a):
    """Assignment: realistic forces/limits — every revolute joint has limits."""
    for j in joints_of(robot_a, "revolute"):
        lim = j.find("limit")
        assert lim is not None, f"{j.get('name')} missing <limit>"
        assert float(lim.get("effort")) > 0
        assert float(lim.get("velocity")) > 0


def test_robot_a_arm_collision_is_primitive(robot_a):
    """Quality: arm collision uses cheap primitives (no trimesh) for stable gz."""
    for link in robot_a.findall("link"):
        if not link.get("name", "").startswith("robot_a_arm_link"):
            continue
        for col in link.findall("collision"):
            geom = col.find("geometry")
            assert geom is not None and geom.find("mesh") is None, \
                f"{link.get('name')} collision must be a primitive, not a mesh"


# ----- robot_b: VIKA 5, cement nozzle ----------------------------------------
@pytest.fixture(scope="module")
def robot_b():
    return run_xacro(prefix="robot_b_", tool="cement", ns="robot_b",
                     arm="true", base_x="2", base_yaw="3.14159")


def test_robot_b_wellformed_and_cement_tool(robot_b):
    assert robot_b.tag == "robot"
    names = link_names(robot_b)
    assert "robot_b_arm_nozzle" in names      # cement nozzle
    assert "robot_b_arm_cement_angle" in [j.get("name") for j in joints_of(robot_b)]


def test_two_robots_differ(robot_a, robot_b):
    """Assignment: each group member has a DIFFERENT kinematic / tool."""
    a_links = link_names(robot_a)
    b_links = link_names(robot_b)
    assert any("suction_pad" in n for n in a_links)   # gripper: suction
    assert any("nozzle" in n for n in b_links)          # cement: nozzle


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
