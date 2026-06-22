<div align="center">

# 🧱 VIKA

### Virtual Industrial Kinematic Arm

**Two cooperating mobile brick-laying robots — built, simulated, and driven from the browser.**

*"Draw a wall. Watch it rise."*

`ROS 2 Jazzy` · `Gazebo Harmonic` · `MoveIt 2` · `React + three.js` · `MCP`

FHTW — MRE2 Robot Modelling, SS2026

</div>

---

## What is this?

VIKA is a simulated **modular masonry automation cell**: two autonomous tracked robots cooperate to build a brick wall. One robot **picks and places** bricks; the other traces the wall edge with a **cement nozzle**. A web HMI shows a live digital twin, lets you jog the tool linearly, drive the bases, and even **draw a wall on a touchscreen** to have the robots build it. An LLM can reconfigure the world live via an MCP server, and a CNN verifies brick placement from the wrist camera.

Real-world inspiration: [FBR Hadrian X](https://www.fbr.com.au) and Construction Robotics SAM100.

## Team & roles

| Author | Robot | Role |
|---|---|---|
| **Elias Bitsch** | 6-axis articulated arm + parallel-jaw gripper | **Pick & place** — grabs bricks from the pallet and sets them precisely (6-DOF IK) |
| **Viktoriia Ovdiienko** | 5-axis arm + cement nozzle | **Line application** — traces the wall top edge as a Cartesian path and extrudes a cement bead |

Two deliberately different serial kinematics, one per author — satisfying the "different kinematics per person" requirement.

## Tech stack

- **Simulation:** Gazebo Harmonic (native in WSL2 Ubuntu 24.04)
- **Middleware:** ROS 2 Jazzy (Docker, host networking) + `ros2_control` + MoveIt 2
- **Mission logic:** BehaviorTree.CPP + Groot2
- **Web HMI:** Vite + React 19 + TypeScript + shadcn/ui + three.js (live URDF twin)
- **Bridge:** `rosbridge_server` (WebSocket :9090) + `ros_gz_bridge`
- **AI bonus:** LLM world-prompting via an **MCP server** · **Grounding DINO** brick-pose detection
- **Docs:** Sphinx → LaTeX → PDF

## Quickstart

> **Prerequisites:** Windows 11 with WSL2 Ubuntu 24.04 · Docker Desktop · Gazebo Harmonic (`sudo apt install gz-harmonic` inside WSL2). The HMI runs in its own container, so no local Node/pnpm is needed.

```bash
# 1. Clone
git clone https://github.com/eliasbitsch/MONUMENTAL.git
cd MONUMENTAL

# 2. Build the images (ROS + HMI; the HMI image installs its own deps)
docker compose -f docker/docker-compose.yml build

# 3. Launch everything (sim + both robots + HMI container on :5173)
./start.sh
```

Then open:
- **HMI** → http://localhost:5173
- **rosbridge** → ws://localhost:9090
- **Gazebo** → native window

## Repository layout

```
vika_ws/          colcon workspace (ROS 2 packages: description, gazebo, moveit, control, bringup, …)
vika-hmi/         Vite web HMI (digital twin, TCP jog, teleop, mission panel, wall-drawing)
vika_docs/        Sphinx documentation (→ PDF)
docker/           Docker image + compose (vika_ros, vika_hmi)
scripts/          helpers — incl. run_tests.sh (unit + e2e)
start-docker.sh   📌 single-entry launcher (headless Gazebo + GUI + both robots + controllers)
start.sh          native (non-Docker) launcher
```

## Tests

```bash
./scripts/run_tests.sh unit   # 18 unit tests — xacro / SRDF / config validation (no sim needed)
./scripts/run_tests.sh e2e    # 11 e2e smoke checks — against a running ./start-docker.sh sim
./scripts/run_tests.sh        # both
```

- **Unit** (`vika_description/test/test_xacro.py`, `vika_moveit/test/test_config.py`): the xacro for both robots parses to valid URDF with the expected joints/links/limits; the SRDF, kinematics and controller configs are well-formed and consistent. Pure parsing — fast and deterministic.
- **E2E** (`vika_bringup/test/e2e_check.py`): both robots publish `joint_states` (6 arm joints + rail), values finite, **arms within limits (no collapse)**, MoveIt `/compute_ik` available, TF `world → *_arm_tcp` resolves.

## Documentation

- **[vika_docs/](vika_docs/)** — Sphinx documentation (rendered to PDF) covering the use case, robot design, simulation, HMI and installation.

## Status

Active coursework project. **Working & verified:** two self-designed serial robots (6-DOF vacuum-gripper arm + 5-DOF cement-nozzle arm) on parallel linear rails facing each other; no joint collapse (folded stow pose); stable Gazebo physics (primitive collision); MoveIt `move_group` + IK; the full test suite (18 unit + 11 e2e) green. **In progress:** clean end-to-end pick & TCP-jog execution (a live `gz_ros2_control` / planning-frame issue under debug), HMI ↔ rail/jog wiring, and the cooperative wall-build choreography.

<div align="center">
<sub>FHTW · MRE2 Robot Modelling · SS2026</sub>
</div>
