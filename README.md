<div align="center">

# 🧱 VIKA

### Virtual Industrial Kinematic Arm

**Two cooperating mobile brick-laying robots — built, simulated, and driven from the browser.**

*"Draw a wall. Watch it rise."*

`ROS 2 Jazzy` · `Gazebo Harmonic` · `MoveIt 2` · `React + three.js` · `MCP` · `YOLOv8`

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
- **AI bonus:** LLM world-prompting via an **MCP server** · **YOLOv8-nano** brick-pose detection
- **Docs:** Sphinx → LaTeX → PDF

## Quickstart

> **Prerequisites:** Windows 11 with WSL2 Ubuntu 24.04 · Docker Desktop · Node 22+ and pnpm 10+ · Gazebo Harmonic (`sudo apt install gz-harmonic` inside WSL2).

```bash
# 1. Clone
git clone https://github.com/eliasbitsch/MONUMENTAL.git
cd MONUMENTAL

# 2. Build the ROS image
docker compose -f docker/docker-compose.yml build

# 3. Install HMI deps
cd vika-hmi && pnpm install && cd ..

# 4. Launch everything
./start.sh
```

Then open:
- **HMI** → http://localhost:5173
- **rosbridge** → ws://localhost:9090
- **Gazebo** → native window

## Repository layout

```
vika_ws/        colcon workspace (ROS 2 packages: description, gazebo, moveit, control, mission, perception, teleop, mcp, bringup)
vika-hmi/       Vite web HMI (digital twin, TCP jog, teleop, mission panel, wall-drawing)
vika_docs/      Sphinx documentation
docker/         Docker image + compose
scripts/        start/stop helpers
start.sh        single-entry launch script
angabe.md       course brief (assignment)
plan.md         📌 full project plan — single source of truth
```

## Documentation

- **[plan.md](plan.md)** — the complete project plan: architecture, robot construction, HMI features, AI integration, the phase roadmap with owners, critical files, risks, and the current implementation state & handoff (§18). **Start here.**
- **[angabe.md](angabe.md)** — the original course brief.

## Status

Active coursework project (interim presentation stage). The 6-DOF arm, MoveIt + Gazebo + `ros2_control` chain, pallet/brick world, and a second twin robot are running; HMI ↔ ROS integration and the full cooperative wall-build are in progress. See [plan.md §18](plan.md) for the detailed up-to-date status.

<div align="center">
<sub>FHTW · MRE2 Robot Modelling · SS2026</sub>
</div>
