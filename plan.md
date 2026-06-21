# VIKA — Complete Project Plan (FHTW MRE2 SS2026)

**Team:** Elias Bitsch · Viktoriia Ovdiienko
**Course:** MRE2 Robot Modelling, SS2026 (FHTW)
**Docs in this repo:** `angabe.md` (course brief) · `plan.md` (this document — single source of truth, includes the current implementation handoff in §18)

## 1. Context

Greenfield coursework project **MRE2 Robot Modelling, SS2026**. A two-student group builds **two cooperating mobile brick-laying robots** on a shared tracked base, but with **deliberately different arm kinematics per person** (see brief line 56). Deliverable = a compiling ROS 2 package + PDF documentation + live demo.

**Work and kinematics split (satisfies brief line 56):**
- **Elias** → **6-axis articulated arm (RRR-RRR, anthropomorphic)** with a parallel-jaw gripper. Role: **pick & place** — grabs bricks from the pallet and sets them precisely (6-DOF IK, arbitrary approach angles).
- **Viktoriia** → **5-axis arm with a cement nozzle** as end effector. Role: **line application** — traces the wall's top edge as a line and lays the cement bead (Cartesian polyline; 5 DOF is sufficient since rotation about the nozzle axis is irrelevant).
- Both share **all remaining tasks** (base, world, HMI, mission BT, sensors, docs) — the individual contribution is each person's self-designed kinematics + tool function.

> This resolves the earlier line-56 conflict ("identical bots"): two demonstrably different serial kinematics (6-DOF vs. 5-DOF), each owned by one author, each with its own real tool function (grasping vs. extruding).

**Goal:** Top grade (>=88%) by fulfilling **all** minimal **and** nice-to-have requirements plus bonus (LLM-controlled robot, CNN camera analysis, teleop, tool changer, conveyor, safety fence, sensor suite).

**Stack (decided):**
- Sim: **Gazebo Harmonic** native in WSL2 Ubuntu 24.04
- ROS 2: **Jazzy** in Docker (`--net=host`)
- HMI: **Vite + React 19 + TS + shadcn/ui + three.js** in the Windows browser
- Bridge: `rosbridge_server` (WebSocket :9090) + `ros_gz_bridge`
- LLM control: **MCP server** (Python, `gz-transport` + ROS 2 actions)
- CV bonus: **YOLOv8-nano** for brick-pose detection via RGBD camera at the TCP
- Teleop: **teleop_twist_joy** (gamepad) + HMI joystick
- Motion: **MoveIt 2** (Cartesian path + Servo for TCP jog)
- Mission logic: **BehaviorTree.CPP** + Groot2 for visualization

---

## 2. Brief Coverage Matrix

| # | Requirement (angabe.md) | Fulfilment | Must/Nice |
|---|---|---|---|
| 1.1 | Self-designed kinematics | Own 6-DOF articulated arm, no copy of a real product | Must ✓ |
| 1.2 | Serial structure | Purely serial RRR-RRR in URDF/xacro | Must ✓ |
| 1.3 | 3–7 DOF | 6-DOF (mobile base not part of the chain) | Must ✓ |
| 1.4 | Different shapes | Articulated arm (anthropomorphic) | Must ✓ |
| 1.5 | Self-designed end effectors | Parallel-jaw gripper + cement nozzle + ISO tool changer | Must ✓ |
| 1.6 | Creative, different kinematics per person | **Elias: 6-axis articulated arm (pick & place)** · **Viktoriia: 5-axis arm with nozzle (line application)** — two different serial kinematics, one per author | Must ✓ |
| 1.7 | Realistic design | Masses, inertia from CAD, motor torque limits in URDF, joint limits from datasheet references | Must ✓ |
| 1.8 | High level of detail | Visible gearbox dummies, cable routing (visual mesh), bolt details | Nice ✓ |
| 1.9 | Real tool function | Gripper jaws with `mimic` joint + F/T sensor, cement nozzle with particle emitter | Nice ✓ |
| 2.1 | 2 robots interact | Bot A picks brick from pallet → handover → Bot B lays it; or alternating courses | Must ✓ |
| 2.2 | Industrial context | Automated wall building (Hadrian X as a real-product reference) | Must ✓ |
| 2.3 | Economically meaningful | Construction-site automation, construction labor shortage — documented in PDF | Must ✓ |
| 2.4 | Industrial environment | Construction-site world: euro pallets + bricks + conveyor + safety fence + warning lights + workbench | Nice ✓ |
| 2.5 | Sensors/actuators | RGBD cam TCP, 2D lidar base, IMU, F/T at tool flange, contact sensor gripper | Nice ✓ |
| 2.6 | AI application | **LLM (Claude via MCP) plans missions** + **CNN (YOLOv8) detects brick poses** | Nice ✓✓ |
| 3.1 | Sim environment with both robots | Gazebo Harmonic, both bots at once | Must ✓ |
| 3.2 | HMI moves TCP linearly (IK) | MoveIt 2 Servo Cartesian jog via HMI buttons + gamepad | Must ✓ |
| 3.3 | Start script | `./start.sh` → `docker compose up` + `ros2 launch vika_bringup full_demo.launch.py` | Must ✓ |
| 3.4 | GUI HMI | Vite+React+shadcn+three.js = web GUI (exceeds Tkinter/QT level) | Nice ✓✓ |
| 4.1 | PDF documentation | Sphinx → LaTeX → PDF, CI-generated | Must ✓ |
| 4.2 | Methodical code docs | Docstrings + Sphinx `autodoc` for Python, Doxygen for C++ | Nice ✓ |
| 4.3 | Rendered images | Gazebo `gz sim --headless` + screenshot pipeline, plus Blender renders from URDF | Nice ✓ |
| 4.4 | ReadTheDocs-style | Sphinx with `sphinx-rtd-theme`, deployed to GitHub Pages | Nice ✓ |

**Bonus beyond the brief:** Digital twin in the HMI, multi-robot coordination, teleop mode, mission BT with Groot viz, MCP world-prompting.

---

## 3. Industrial Scenario

**"Modular Masonry Automation Cell"** — two autonomous tracked vehicles build a wall in a fenced-off construction cell:

1. A **pallet** with 20 bricks sits at the edge
2. **Bot A** drives to the pallet, picks a brick with the gripper, drives to the handover zone
3. **Bot B** receives the brick via a tool-changer handshake (or directly from Bot A's gripper)
4. **Bot A** swaps its tool to the cement nozzle, applies a cement bead on the current wall top edge
5. **Bot B** places the brick precisely with 6-DOF IK onto the cement bead
6. Roles can be swapped per course (Bot A+B are interchangeable → real cooperation)
7. Loop until the wall (4 courses × 5 bricks) is finished
8. **CNN** verifies brick pose after placement (RGBD cam on the placing TCP)
9. **LLM** can reconfigure the world via MCP ("spawn extra pallet at (3,2)", "add 10 bricks")

**Real-world references:** FBR Hadrian X, Construction Robotics SAM100.

---

## 4. System Architecture

### 4.1 Data Flow

```
  Windows Browser (Vite + React + three.js + shadcn)
    │  WebSocket :9090 (roslibjs)
    ▼
  WSL2 Docker: rosbridge_server (--net=host)
    │  DDS
    ▼  ┌─────────────────────────────────────┐
    │  │ ROS 2 Jazzy nodes (Docker)          │
    │  │  - MoveIt 2 (A + B, namespaced)     │
    │  │  - ros2_control (tracks, arm, tool) │
    │  │  - Mission BT (BehaviorTree.CPP)    │
    │  │  - Nav2 (optional, simple cmd_vel)  │
    │  │  - web_video_server (cam streams)   │
    │  │  - cnn_brick_detector (YOLOv8)      │
    │  │  - teleop_twist_joy                 │
    │  └─────────────────────────────────────┘
    │  DDS
    ▼
  WSL2 NATIVE: ros_gz_bridge ←→ Gazebo Harmonic
                                  │ physics + sensors + plugins
                                  └─ MCP Server (Python)  ← Claude
```

### 4.2 Colcon Workspace Layout

```
vika_ws/src/
├── vika_description/        # URDF/xacro, meshes, materials
│   ├── urdf/
│   │   ├── base_tracked.xacro
│   │   ├── arm_6dof.xacro                # articulated arm RRR-RRR
│   │   ├── tool_gripper.xacro
│   │   ├── tool_cement.xacro
│   │   ├── tool_changer.xacro
│   │   └── vika.urdf.xacro               # composition (with ${prefix} arg for namespace)
│   ├── meshes/                           # STL/DAE from Fusion 360/FreeCAD
│   └── rviz/view_robot.rviz
│
├── vika_gazebo/             # worlds + plugin config
│   ├── worlds/construction_site.sdf
│   ├── models/brick/
│   ├── models/europallet/
│   ├── models/conveyor_belt/
│   ├── models/safety_fence/
│   ├── models/warning_light/
│   ├── config/bridge_config.yaml
│   └── launch/spawn_world.launch.py
│
├── vika_moveit/             # MoveIt 2 config (6DOF, instantiated twice with namespaces robot_a/robot_b)
│
├── vika_control/
│   ├── config/controllers.yaml
│   └── launch/controllers.launch.py
│
├── vika_mission/            # mission BT + actions
│   ├── bt_trees/build_wall.xml
│   ├── src/bt_nodes/*.cpp
│   └── action/PickBrick.action, PlaceBrick.action, ApplyCement.action
│
├── vika_perception/         # YOLOv8 brick detector
│   ├── vika_perception/cnn_brick_detector.py
│   ├── models/brick_yolov8n.onnx
│   └── launch/perception.launch.py
│
├── vika_teleop/             # joy + HMI teleop bridge
│   └── launch/teleop.launch.py
│
├── vika_hmi_bridge/         # rosbridge + custom services
│   ├── src/tcp_linear_jog_service.py
│   └── launch/hmi.launch.py
│
├── vika_mcp/                # MCP server for LLM world-prompting
│   ├── vika_mcp/server.py
│   ├── vika_mcp/tools/{spawn,pose,sensor,simctl,mission}.py
│   └── pyproject.toml
│
├── vika_bringup/
│   ├── launch/full_demo.launch.py       # single entry, starts everything
│   ├── launch/single_robot.launch.py
│   └── config/sim_params.yaml
│
└── vika_docs/               # Sphinx source
    ├── conf.py
    ├── index.rst
    └── pdf-build.sh → LaTeX → PDF

vika-hmi/                    # Vite web app
├── src/
│   ├── scene/UrdfTwin.tsx       # three.js + urdf-loader, live joint_states
│   ├── scene/BrickWorld.tsx     # digital twin of the world
│   ├── ros/useRos.ts            # roslibjs hook
│   ├── ros/useTopic.ts
│   ├── ros/useService.ts
│   ├── panels/TcpJogPanel.tsx   # XYZ linear jog (IK — required!)
│   ├── panels/RobotSelector.tsx
│   ├── panels/MissionPanel.tsx  # start/pause/abort + BT status
│   ├── panels/SensorPanel.tsx   # cam feed + lidar scan + F/T
│   ├── panels/TeleopPanel.tsx   # virtual joystick
│   ├── panels/WorldPromptPanel.tsx  # LLM chat → MCP
│   └── App.tsx
├── vite.config.ts
└── package.json

docker/
├── Dockerfile.ros               # osrf/ros:jazzy-desktop + deps
├── Dockerfile.perception        # CUDA + torch + ultralytics
└── docker-compose.yml

start.sh                         # top-level launch script (required, brief line 88)
```

---

## 5. Robot Construction (Detail)

### 5.1 Shared Base — Tracked Mobile Platform
- **Footprint:** 1.2 m × 0.8 m × 0.4 m
- **Drive:** 2 tracks (Gazebo `TrackController` plugin; fallback `DiffDrive` with animated track mesh)
- **Mass:** ~180 kg (realistic for a tracked vehicle this size, inertia tensor from CAD)
- **Joints:** 2× continuous (left_track, right_track) + 2× cosmetic-mimic for visible sprockets
- **Sensors:** 2D lidar front (Sick-TiM style, 270°), IMU center, bumper contact
- **Visual:** grey steel structure with a yellow warning stripe, warning light on top

### 5.2 Elias's Arm — 6-DOF Articulated Arm (Pick & Place)
- **Author:** Elias Bitsch
- **Kinematics:** classic RRR-RRR (shoulder + elbow + 3-DOF spherical wrist)
- **Reach:** 1.4 m
- **Payload:** 7 kg (brick ~3 kg + tool changer + gripper with reserve)
- **Joints (limits/torques realistic, sized after the KUKA KR6 class — dimensions as reference, geometry self-made):**
  - J1 (base): ±185°, 80 Nm
  - J2 (shoulder): -155..+35°, 80 Nm
  - J3 (elbow): -130..+154°, 60 Nm
  - J4 (wrist roll): ±350°, 20 Nm
  - J5 (wrist pitch): ±130°, 20 Nm
  - J6 (tool rotation): ±350°, 15 Nm
- **Level of detail (brief line 59):** visible harmonic-drive dummies at J2/J3, external cable-duct mesh along the upper arm
- **Role:** pick (top-down from pallet), handover, place (angled possible thanks to full 6-DOF orientation)
- **End effector:** parallel-jaw gripper (see 5.4)

### 5.3 Viktoriia's Arm — 5-DOF with Cement Nozzle (Line Application)
- **Author:** Viktoriia Ovdiienko
- **Kinematics:** 5-DOF serial (RRR shoulder/elbow + 2-DOF wrist) — **deliberately one axis fewer**: for tracing a cement line, rotation about the nozzle's long axis (J6) is functionless and is dropped. A clean, standalone kinematic (not Elias's arm minus one axis — its own geometry/dimensions).
- **Reach:** 1.5 m (slightly longer, to reach over the wall top edge)
- **Payload:** 5 kg (nozzle + tool changer + cement reserve)
- **Joints:**
  - J1 (base): ±185°, 80 Nm
  - J2 (shoulder): -150..+40°, 80 Nm
  - J3 (elbow): -125..+150°, 55 Nm
  - J4 (wrist pitch): ±130°, 20 Nm
  - J5 (wrist yaw / nozzle approach angle): ±180°, 15 Nm
- **Role:** traces the current wall top edge as a Cartesian **polyline** (MoveIt 2 Cartesian path) and extrudes the cement bead while doing so. 5 DOF is enough because the nozzle is rotationally symmetric.
- **End effector:** cement nozzle (see 5.4)

### 5.4 Tool Changer + End Effectors
- **ISO-style coupling:** pneumatic snap via `fixed_joint` spawn/despawn at runtime
- **Tool 1 — parallel-jaw gripper:**
  - 2× prismatic (mimic joint for symmetric closing)
  - `ros2_control` `gripper_action_controller`
  - F/T sensor at the flange
  - contact sensor in the jaws (Gazebo `ContactSensor`) → grasp confirmation
- **Tool 2 — cement nozzle:**
  - revolute nozzle head (1 DOF for the application angle)
  - Gazebo particle-plugin emitter (visual cement strand)
  - activation via ROS service `/tool/cement/extrude`
  - "glue" logic: after a cement bead, placed bricks are fixed to the wall link via an `attach_link` service

---

## 6. Environment & Assets (brief lines 70-72)

| Asset | Source | Purpose |
|---|---|---|
| Euro pallet (1200×800) | Fuel + own texture | brick source |
| Brick (240×115×71 mm) | own SDF, 20× on the pallet | workpiece |
| Wall-zone marker | own SDF (ground marker) | target area |
| Safety fence | Fuel `safety_fence` + extend | industrial environment |
| Conveyor | Fuel `conveyor` or own | brick resupply (stretch) |
| Warning light | own SDF + light source | active on robot motion |
| Workbench + toolbox | Fuel | ambient decoration |
| Dust/particle FX | Gazebo particle | realism |
| Skybox + ground texture | concrete PBR | industrial look |

Sources: [Gazebo Fuel](https://app.gazebosim.org/fuel/models), [3DGEMS 270+ models](https://data.nvision2.eecs.yorku.ca/3DGEMS/), [gazebo_models_worlds_collection](https://github.com/leonhartyao/gazebo_models_worlds_collection).

---

## 7. HMI Features (Web GUI)

| Panel | Function | ROS interface |
|---|---|---|
| Robot selector | A / B / Both | client state |
| 3D digital twin | three.js scene with both URDFs, animated from `/joint_states` | `roslibjs` topic |
| **TCP linear jog** (required!) | ±X/±Y/±Z buttons, step-size slider | service `/move_tcp_linear` (MoveIt 2 Cartesian) |
| TCP pose display | live pose readout | `/tf` |
| Teleop joystick | base driving via virtual joystick | `/cmd_vel` |
| Gripper control | open/close + force slider | action `gripper_cmd` |
| Tool swap | dropdown gripper/cement | service `/tool/swap` |
| Mission panel | start/pause/abort, BT state, phase progress | action `/mission/build_wall` |
| Sensor panel | live cam (web_video_server), lidar 2D plot, F/T gauge, IMU | topics |
| CNN overlay | brick-detection bounding boxes on the cam feed | `/perception/detections` |
| **World prompt panel** | chat input → sent to MCP → Claude modifies the world live | custom WS |
| Logs + BT viz | filtered rosout + embedded Groot2 | `/rosout` |
| **Google 3D Tiles ground** | photorealistic 3D Tiles (Google Maps API) as the twin scene background, site georeferenced to real coordinates | `3d-tiles-renderer` npm |
| **Wall drawing (iPad-ready)** | touch polyline on a grid overlay (top-down or perspective), "Plan Wall" samples the line → brick positions → mission start | action `/mission/build_custom_wall` (geometry_msgs/Polygon) |

---

## 8. AI Integration (Bonus, brief line 74)

### 8.1 LLM Controls the Robot (via MCP)
- Python MCP server (`vika_mcp/server.py`) exposes tools:
  - `spawn_model(uri, pose)` / `delete_model(name)` / `list_models()`
  - `set_model_pose(name, pose)` / `attach_link(parent, child)`
  - `get_sensor(topic, timeout)` with a server-side filter (95% token savings)
  - `mission_start(plan_yaml)` / `mission_abort()`
  - `move_tcp(robot, xyz, rpy)` (calls the MoveIt 2 action)
- Claude Desktop or Claude Code talks to MCP directly → world prompting:
  > "Spawn 5 extra bricks at random poses on the pallet and start the build_wall mission"

### 8.2 CNN Computer Vision
- **YOLOv8-nano** on an own brick dataset (~500 synthetic images from Gazebo headless render, labels from known-truth poses)
- Inference node `cnn_brick_detector.py` subscribes to `/robot_b/wrist_camera/image_raw`, publishes `/perception/detections` (vision_msgs/Detection3DArray)
- The mission BT uses detections for fine-placement correction before each place

---

## 9. Start Script (brief line 88)

**`./start.sh`:**
```bash
#!/usr/bin/env bash
set -e
xhost +local:docker          # for Gazebo GUI from Docker (optional — Gazebo runs natively)
docker compose -f docker/docker-compose.yml up -d ros_jazzy perception
wsl.exe -d Ubuntu -- bash -c "gz sim -r vika_gazebo/worlds/construction_site.sdf" &
sleep 5
docker compose exec ros_jazzy bash -c \
  "source /opt/ros/jazzy/setup.bash && source install/setup.bash && \
   ros2 launch vika_bringup full_demo.launch.py"
# HMI separately:
( cd vika-hmi && pnpm dev ) &
```

---

## 10. Documentation (brief lines 91-101)

- **Sphinx** workspace with `sphinx-rtd-theme` → build pipeline:
  - `autodoc` for Python (vika_mcp, vika_perception)
  - `breathe + doxygen` for C++ (BT nodes)
  - Chapters: Introduction / Industrial Scenario / Robot Construction / Simulation / HMI / AI Modules / Installation / Launch Guide / API Reference
  - **PDF via LaTeX** (`make latexpdf`) — required, brief line 97
  - HTML on GitHub Pages (bonus, brief line 101)
- **Rendered images:** Gazebo `gz sim --headless-rendering` + Python screenshot script for 6 key poses
- **Backup video:** OBS recording of the live demo for the interim and final presentations
- **IMRAD-structured presentations** (brief line 110): Introduction / Methods / Results / Discussion

---

## 11. Phase Roadmap (for later execution)

Owner legend: **Elias** (6-axis arm + pick & place) · **Viktoriia** (5-axis arm + nozzle/line) · **Both** (shared infrastructure).

| # | Phase | Deliverable | Owner |
|---|---|---|---|
| 1 | Bootstrap | WSL2 + Docker images + colcon ws + Vite skeleton | Both |
| 2 | Base URDF | tracked base drives in Gazebo via `ros2 topic pub /cmd_vel` | Both |
| 3a | Arm 6-DOF URDF | xacro + MoveIt 2 config + IK in RViz (pick & place arm) | **Elias** |
| 3b | Arm 5-DOF URDF | xacro + MoveIt 2 config + Cartesian path in RViz (nozzle arm) | **Viktoriia** |
| 4a | Gripper + changer | parallel-jaw gripper + tool-swap service | **Elias** |
| 4b | Cement nozzle + changer | nozzle head + `/tool/cement/extrude` service | **Viktoriia** |
| 5 | World assets | pallet + 20 bricks + fence + conveyor + warning light | Both |
| 6 | HMI MVP | Vite + shadcn + rosbridge + URDF twin + `/joint_states` live | Both |
| 7 | HMI TCP jog | Servo Cartesian via buttons → IK moves the TCP linearly (required!) | Both |
| 8 | Pick/place one-shot | Elias's arm picks one brick, places it on the wall | **Elias** |
| 9 | Cement-line one-shot | Viktoriia's arm traces a line + extrudes a cement bead | **Viktoriia** |
| 10 | Mission BT | build_wall.xml — full cooperative sequence | Both |
| 11 | Multi-robot | both bots in one world (namespaces), handover works | Both |
| 12 | Cement FX | particle emitter + wall attachment | **Viktoriia** |
| 13 | Teleop | joy node + HMI joystick | **Elias** |
| 14 | MCP server | Python tools + Claude spawn test | **Viktoriia** |
| 15 | CNN perception | YOLOv8 training + inference node + HMI overlay | **Elias** |
| 16 | Sensor suite | RGBD + lidar + F/T + IMU + contact wired up | Both |
| 17 | Polish & docs | Sphinx → PDF, rendered images, docs, backup video | Both |
| 18 | Dry-run presentation | end-to-end demo runs reproducibly | Both |
| 19 | **Google 3D Tiles ground** | HMI scene loads photorealistic 3D Tiles via `3d-tiles-renderer`, site georeferenced | **Elias** |
| 20 | **iPad wall drawing** | touch polyline on a grid overlay → sample to brick positions → action `/mission/build_custom_wall` → BT builds the custom wall | Both |

---

## 12. Critical Files (to create)

| Path | Purpose |
|---|---|
| `vika_ws/src/vika_description/urdf/vika.urdf.xacro` | composition (namespace via `${prefix}` arg for robot_a / robot_b) |
| `vika_ws/src/vika_description/urdf/arm_6dof.xacro` | 6-DOF articulated arm |
| `vika_ws/src/vika_gazebo/worlds/construction_site.sdf` | world |
| `vika_ws/src/vika_mission/bt_trees/build_wall.xml` | BehaviorTree |
| `vika_ws/src/vika_mcp/vika_mcp/server.py` | MCP server |
| `vika_ws/src/vika_perception/vika_perception/cnn_brick_detector.py` | YOLOv8 node |
| `vika_ws/src/vika_bringup/launch/full_demo.launch.py` | top-level launch |
| `vika-hmi/src/panels/TcpJogPanel.tsx` | **required feature** TCP linear jog |
| `vika-hmi/src/scene/UrdfTwin.tsx` | digital twin |
| `vika-hmi/src/scene/GoogleTilesGround.tsx` | photorealistic 3D Tiles layer |
| `vika-hmi/src/panels/WallDrawPanel.tsx` | touch polyline → wall plan (iPad killer feature) |
| `vika_ws/src/vika_mission/src/wall_sampler.py` | polyline→brick-positions sampler + action server |
| `docker/docker-compose.yml` | reproducible runtime |
| `start.sh` | single-script launch (required) |
| `vika_docs/conf.py` | Sphinx PDF build |

---

## 13. Verification / Live-Demo Scenario

1. `wsl --distribution Ubuntu-24.04`
2. `./start.sh` in the repo root
3. Gazebo opens the construction-site world with both bots, pallet, fence
4. Browser to `http://localhost:5173` → HMI loads, 3D twin shows both bots in sync with Gazebo
5. HMI → **TCP jog panel**, select Robot B, ±X button → TCP moves 5 cm linearly (IK proof ✓)
6. HMI → **teleop panel** → virtual joystick → Bot A drives manually
7. HMI → **mission panel** → "Start build_wall" → full sequence:
   - Bot A picks brick → handover → Bot B places → cement bead → next
8. HMI → **sensor panel** shows live cam, lidar, CNN bbox overlay
9. HMI → **world prompt panel**: text "spawn 3 bricks at random poses" → Claude via MCP → bricks appear in sim
10. Wall finished (4 courses × 5 bricks) → success state
11. **Killer demo:** iPad opens `http://<wsl-ip>:5173` → user draws an L-shaped line on the grid overlay (Google 3D Tiles background shows the real surroundings) → "Plan Wall" → bots build exactly that wall

**Acceptance per phase:** `colcon build` without errors, `colcon test` green, HMI panels without browser-console errors.

---

## 14. Open Risks + Mitigations

| Risk | Mitigation |
|---|---|
| `TrackController` unstable in Harmonic | fallback `DiffDrive` + cosmetic track mesh |
| Particle FX for cement limited | fallback: animated mesh extrusion as the cement bead |
| 2 MoveIt 2 instances on the same master | separate namespaces `/robot_a` `/robot_b`, test early |
| DDS Docker→native over `--net=host` | alternative: run rosbridge entirely in the container |
| CNN training time | synthetic data from Gazebo + transfer learning from YOLOv8n |
| "Same kinematics" conflict (brief line 56) | **Resolved**: the group deliberately builds two different arms (Elias 6-DOF, Viktoriia 5-DOF) — confirm with the instructor at the first meeting |
| Time budget (SS2026) | strict phase roadmap, MVP-first, nice-to-haves as the last phase |

---

## 15. Sources

- [Gazebo Fuel model library](https://app.gazebosim.org/fuel/models)
- [Gazebo Small Warehouse worlds](https://discourse.openrobotics.org/t/gazebo-small-warehouse-bookstore-and-small-house-worlds-available-for-simulation/14915)
- [3DGEMS 270+ Gazebo SDF models](https://data.nvision2.eecs.yorku.ca/3DGEMS/)
- [Community Gazebo MCP Server](https://lobehub.com/mcp/yourusername-gazebo-mcp)
- [Gazebo Harmonic Sensors + Plugins](https://medium.com/@alitekes1/gazebo-sim-plugin-and-sensors-for-acquire-data-from-simulation-environment-681d8e2ad853)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [FBR Hadrian X — real-world reference](https://www.fbr.com.au)
- [rosbridge_suite docs](https://github.com/RobotWebTools/rosbridge_suite)
- [MoveIt 2 Servo Cartesian Jog](https://moveit.picknik.ai/main/doc/examples/realtime_servo/realtime_servo_tutorial.html)
- [Google Photorealistic 3D Tiles API](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)
- [3d-tiles-renderer (NASA-AMMOS, three.js)](https://github.com/NASA-AMMOS/3DTilesRendererJS)

---

## 16. Installation & Quickstart

**Prerequisites:**
- Windows 11 with **WSL2 Ubuntu 24.04**
- **Docker Desktop** (or Docker Engine inside WSL2)
- **Node 22+** and **pnpm 10+** on Windows (for the HMI dev server)
- **Gazebo Harmonic** native in WSL2:
  ```bash
  # inside WSL2
  sudo apt update && sudo apt install -y gz-harmonic
  ```

**First-time setup:**
```bash
# 1. Build the ROS image
docker compose -f docker/docker-compose.yml build

# 2. Install HMI deps (on Windows)
cd vika-hmi && pnpm install && cd ..
```

**Run:**
```bash
./start.sh
```
Opens:
- HMI: http://localhost:5173
- rosbridge: ws://localhost:9090
- native Gazebo window

**Repo layout:**
```
vika_ws/        colcon workspace (ROS 2 packages)
vika-hmi/       Vite web HMI
vika_docs/      Sphinx documentation
docker/         Docker image + compose
start.sh        single-entry launch script
angabe.md       course brief
plan.md         project plan (single source of truth)
```

---

## 17. Mesh Drop-in Convention (Arm Meshes)

The folder `vika_ws/src/vika_description/meshes/arm/` holds STL/DAE files with **exactly these filenames**. The launch file auto-detects each one and replaces the corresponding primitive; anything not present stays a box/cylinder.

| Filename         | Replaces (link)  | Primitive fallback             |
|------------------|------------------|--------------------------------|
| `base_link.stl`  | `arm_base_link`  | cylinder r=0.12, h=0.15        |
| `link1.stl`      | `arm_link1`      | box 0.18 × 0.18 × 0.25         |
| `link2.stl`      | `arm_link2`      | box 0.12 × 0.14 × 0.55         |
| `link3.stl`      | `arm_link3`      | box 0.10 × 0.12 × 0.45         |
| `link4.stl`      | `arm_link4`      | cylinder r=0.05, h=0.12        |
| `link5.stl`      | `arm_link5`      | box 0.08 × 0.08 × 0.08         |
| `tool0.stl`      | `arm_tool0`      | cylinder r=0.035, h=0.04       |

**Authoring rules:** mesh origin (0,0,0) = URDF link frame (joint at the parent end), Z up, meters. The `<origin>` offset stored in the xacro is applied on top — either re-model the mesh shifted, or adjust the per-link `<origin>` block in `arm_6dof.xacro`. STLs in mm → re-export in meters or scale on the `<mesh>` element. The same file is used for collision; for high-poly visuals consider a separate simplified collision STL.

**Verify a drop-in:**
```bash
cp my_link2.stl meshes/arm/link2.stl
colcon build --packages-select vika_description
ros2 launch vika_bringup arm_demo.launch.py
```

---
## 18. Current Implementation State & Handoff

> Status: 2026-06-20. Describes the **actual current state** of the code. VIKA = **V**irtual **I**ndustrial **K**inematic **A**rm. Tagline: *"Draw a wall. Watch it rise."*
> This section supersedes the older roadmap above wherever they disagree.

### 18.1 Runtime stack (as-is)
- Native Linux + Docker (no WSL). All ROS 2 Jazzy + Gazebo Harmonic run **inside the `vika_ros` container**; the HMI runs in `vika_hmi`.
- **`./start-docker.sh`** is the single entry point: headless Gazebo **server** (`gz sim -r -s`) + a **separate GUI client** forced onto Mesa software GLX (NVIDIA/Wayland crashes the GUI otherwise) + `full_demo.launch.py` (bridge, robot spawn, controllers) + rosbridge, then `reset_bricks.sh` and `fold_arms.py`.
- The GUI is optional/cosmetic; the server, controllers and HMI do not need it.

### 18.2 Use case (assignment §2)
Two cooperating, self-designed serial robots on parallel **linear rails**, facing each other across a wall line, building a brick wall:
- **robot_a — VIKA (Elias):** 6-DOF articulated arm + **vacuum suction gripper** (3 pads → picks a row of 3 bricks). Pick & place from the pallet.
- **robot_b — VIKA 5 (Viktoriia):** 5-effective-DOF arm (j4 locked) + **cement nozzle**. Traces the wall edge (cement bead).
Two deliberately different kinematics / end effectors → satisfies the "different kinematics per member" rule.

### 18.3 What works (verified)
- **Two robots, no collapse.** `gz_ros2_control` holds every joint; arms spawn in a compact **folded stow pose** along their rails (no "kissing" in the centre, no drooping).
- **Linear rail base** (replaces the earlier tracked mobile base): each robot is anchored in the URDF (`base_x` / `base_yaw` — the world-fixed rail ignores the spawn pose) at ±2 m, on a 12.5 m rail; the carriage is a prismatic joint driven by `rail_controller`.
- **Stable physics:** arm collision is **primitive** (boxes/cylinders), not trimesh — 0 ODE trimesh-overflows (was 1000+), no gz crash.
- **MoveIt `move_group`** runs against the live `gz_ros2_control` controllers; **`/compute_ik` works** (KDL), TF chain intact.
- **Vacuum attach/lift mechanism:** 3 gz `DetachableJoint`s grab the 3 dynamic pick bricks on an attach topic; `reset_bricks.sh` drops them cleanly onto the pallet at startup.
- **Tests:** `./scripts/run_tests.sh` — 18 unit tests (xacro/SRDF/config) + 11 e2e smoke checks (joint_states, no-collapse, IK service, TF) — all green on a healthy sim.

### 18.4 What is fragile / open (needs interactive debug)
- **Live trajectory execution is unreliable after the rail-anchoring change.** `arm_controller` reports `Goal reached, success!` but the arm sometimes does not move (especially once it has been driven into a tangled pose), and a MoveGroup-planned pose can report success yet land the TCP at the wrong place — a **frame / execution mismatch** that needs hands-on debugging (suspects: gz_ros2_control state after a contorted pose, or the world-anchored base interacting with the IK/planning frame).
- Consequence: the end-to-end **pick** (`pick3_lift.py`) and **TCP jog** (`tcp_jog.py`) are written and correct-by-design but do not yet run cleanly start-to-finish in this build.
- **`start-docker.sh` / `docker exec -d` launches are intermittently flaky** — a relaunch sometimes does not actually (re)start gz; re-run, or launch the steps manually. The container was also OOM-killed once during a long idle (Exit 137); just `docker compose up -d` to bring it back.
- **HMI ↔ rail/jog:** the web HMI still publishes the dead `cmd_vel` (from the mobile-base era); the TCP jog is implemented as a **console app** (`tcp_jog.py`, assignment §3 minimum) but not yet wired into the web UI.

### 18.5 Key files (as-is)
```
vika_ws/src/
├── vika_description/
│   ├── urdf/vika.urdf.xacro            ← top-level: base_rail + arm_6dof + tool + ros2_control
│   ├── urdf/base_rail.xacro            ← world-anchored rail + prismatic carriage (base_x/base_yaw)
│   ├── urdf/arm_6dof.xacro             ← 6-DOF arm; PRIMITIVE collision, mesh visual
│   ├── urdf/tool_gripper.xacro         ← vacuum gripper: bar + 3 suction pads + 3 DetachableJoints
│   ├── urdf/tool_cement.xacro          ← cement nozzle (robot_b)
│   ├── urdf/vika.ros2_control.xacro    ← gz_ros2_control; folded initial_value (stow pose)
│   ├── meshes/arm/ROD-STL/*.stl        ← Fusion STLs (visual only)
│   └── test/test_xacro.py              ← unit tests (parse + structure)
├── vika_moveit/
│   ├── config/robot_a.{srdf,_kinematics,_joint_limits,_moveit_controllers}.yaml
│   ├── launch/robot_a_move_group.launch.py  ← move_group for the live robot_a
│   ├── scripts/arm_client.py           ← reusable IK(seed,collision)+action exec + MoveGroup plan
│   ├── scripts/tcp_jog.py              ← console HMI: linear TCP jog via IK (assignment §3)
│   ├── scripts/pick3_lift.py           ← 3-brick längs pick (lower→attach→lift)
│   ├── scripts/fold_arms.py            ← stow both arms along their rails
│   └── test/test_config.py             ← unit tests (SRDF/kinematics/controllers)
├── vika_gazebo/
│   ├── worlds/construction_site.sdf    ← pallet + static bricks + 3 dynamic pick bricks
│   └── scripts/reset_bricks.sh         ← detach + set_pose pick bricks onto the pallet
├── vika_control/config/controllers_robot_{a,b}.yaml  ← jsb + arm + rail (+ tool) controllers
└── vika_bringup/
    ├── launch/full_demo.launch.py      ← bridge + spawn both robots + controllers
    └── test/e2e_check.py               ← e2e smoke checks against a running sim

start-docker.sh           ← MASTER launcher (headless server + Mesa GUI + stack + reset/fold)
scripts/run_tests.sh      ← unit + e2e test runner
```

### 18.6 Demo workflow (start-from-zero)
```bash
./start-docker.sh                 # brings up gz (headless) + GUI + both robots + controllers
./scripts/run_tests.sh            # 18 unit + 11 e2e checks — proves the sim is healthy
# HMI:       http://localhost:5173
# console TCP jog (once move_group is up):  ros2 launch vika_moveit robot_a_move_group.launch.py
#   then:    python3 /ws/src/vika_moveit/scripts/tcp_jog.py   (x+/x-/y+/y-/z+/z-)
./start-docker.sh stop            # stop the sim processes
```

### 18.7 Known pitfalls (current)
1. **`GZ_PARTITION=vika` is required** for any `gz` CLI from a fresh `docker exec` shell (else `gz topic/model/service` silently see nothing).
2. **Gazebo GUI segfaults in `libGLX_nvidia`** (Wayland/Xwayland) — the GUI client is forced onto Mesa software GLX (`__GLX_VENDOR_LIBRARY_NAME=mesa`).
3. **URDF→SDF fixed-joint lumping** merges the gripper/pad links into `*_arm_tool0`; gz plugins (DetachableJoint) must reference `tool0`.
4. **gz `DetachableJoint` auto-attaches at load** — `reset_bricks.sh` detaches + repositions the bricks at startup.
5. **Coarse primitive collision** → MoveIt self-collision is fully disabled in the SRDF (it would otherwise report false `START_STATE_IN_COLLISION`).
6. **`pkill -f` in scripts must use the `[x]`-bracket trick** (a bare pattern matches the killer shell → SIGKILL / exit 137).

### 18.8 Recommendations for the next session
**P1 — fix live execution:** from a *fresh* `./start-docker.sh`, command a single arm joint via the action and confirm the arm physically moves; if not, isolate `gz_ros2_control` (command vs state interface) before re-testing `tcp_jog.py` / `pick3_lift.py`. Resolve the move_group planning-frame mismatch (TCP target vs achieved pose).
**P2 — wire the HMI** TCP-jog buttons to `tcp_jog`/MoveIt Servo instead of the dead `cmd_vel`.
**P3 — robot_b participation:** trace the wall edge with the cement nozzle (Cartesian path) so both robots demonstrably share the process.
**P4 — docs PDF** (assignment §4): the markdown is current; render `vika_docs` (Sphinx → LaTeX → PDF).
