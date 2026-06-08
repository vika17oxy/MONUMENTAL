# VIKA — Vollständiger Projektplan (FHTW MRE2 SS2026)

**Team:** Elias Bitsch · Viktoriia Ovdiienko
**LV:** MRE2 Robotermodellierung, SS2026 (FHTW)
**Repo-Struktur (Doku):** `angabe.md` (Aufgabenstellung) · `plan.md` (dieses Dokument, Source of Truth) · `HANDOFF.md` (Session-Übergabe / aktueller Stand)

## 1. Context

Greenfield Lehrveranstaltungs-Projekt **MRE2 Robotermodellierung, SS2026**. Zwei Studierende (Gruppe) konstruieren **zwei kooperierende mobile Brick-Laying-Roboter** auf gemeinsamem Kettenfahrwerk, aber mit **bewusst unterschiedlicher Arm-Kinematik pro Person** (siehe Angabe Z.56). Abgabe = kompilierendes ROS2-Paket + PDF-Doku + Live-Demo.

**Arbeits- und Kinematik-Aufteilung (erfüllt Angabe Z.56):**
- **Elias** → **6-Achs-Knickarm (RRR-RRR, anthropomorph)** mit Parallelbackengreifer. Rolle: **Pick & Place** — greift Ziegel von der Palette und setzt sie präzise (6-DOF-IK, beliebige Anstellwinkel).
- **Viktoriia** → **5-Achs-Arm mit Zementdüse** als Endeffektor. Rolle: **Linien-Applikation** — fährt die Wand-Oberkante als Linie ab und legt den Zement-Bead (kartesischer Linienzug, 5-DOF reicht, da Rotation um die Düsenachse irrelevant ist).
- Beide teilen sich **alle übrigen Tasks** (Base, Welt, HMI, Mission-BT, Sensorik, Docs) — die individuelle Note liegt in der jeweils selbst konstruierten Kinematik + Werkzeugfunktion.

> Damit ist der frühere Z.56-Konflikt ("identische Bots") aufgelöst: zwei nachweislich verschiedene serielle Kinematiken (6-DOF vs. 5-DOF), jede einem Autor zugeordnet, jede mit eigener realer Werkzeugfunktion (Greifen vs. Extrudieren).

**Ziel:** Sehr gut (>=88%) durch Erfüllung **aller** Minimal- **und** Nice-to-Have-Anforderungen plus Bonus (LLM-gesteuerter Roboter, CNN-Kameraauswertung, Teleop, Werkzeugwechsler, Förderband, Schutzzaun, Sensor-Suite).

**Stack (entschieden):**
- Sim: **Gazebo Harmonic** native in WSL2 Ubuntu 24.04
- ROS2: **Jazzy** in Docker (`--net=host`)
- HMI: **Vite + React 19 + TS + shadcn/ui + three.js** im Windows-Browser
- Bridge: `rosbridge_server` (WebSocket :9090) + `ros_gz_bridge`
- LLM-Steuerung: **MCP-Server** (Python, `gz-transport` + ROS2-Actions)
- CV-Bonus: **YOLOv8-nano** für Brick-Pose-Erkennung via RGBD-Kamera am TCP
- Teleop: **teleop_twist_joy** (Gamepad) + HMI-Joystick
- Motion: **MoveIt2** (Cartesian-Path + Servo für TCP-Jog)
- Mission Logic: **BehaviorTree.CPP** + Groot2 zur Visualisierung

---

## 2. Angabe-Coverage-Matrix

| # | Anforderung (angabe.md) | Erfüllung | Must/Nice |
|---|---|---|---|
| 1.1 | Selbst-erstellte Kinematik | Eigener 6-DOF Knickarm, keine Realkopie | Must ✓ |
| 1.2 | Serielle Struktur | Rein seriell RRR-RRR in URDF/xacro | Must ✓ |
| 1.3 | 3–7 DOF | 6-DOF (mobile Base nicht Teil der Kette) | Must ✓ |
| 1.4 | Verschiedene Formen | Knickarm (Anthropomorph) | Must ✓ |
| 1.5 | Selbsterstellte Endeffektoren | Parallelbackengreifer + Zementdüse + ISO-Tool-Changer | Must ✓ |
| 1.6 | Kreativ, unterschiedliche Kinematik je Person | **Elias: 6-Achs-Knickarm (Pick&Place)** · **Viktoriia: 5-Achs-Arm mit Düse (Linien-Applikation)** — zwei verschiedene serielle Kinematiken, je Autor zugeordnet | Must ✓ |
| 1.7 | Realitätsnahe Auslegung | Gewichte, Inertia aus CAD, Motor-Torque-Limits im URDF, Joint-Limits aus Datenblatt-Referenzen | Must ✓ |
| 1.8 | Hoher Detailgrad | Sichtbare Getriebe-Dummies, Kabelführung (Visual-Mesh), Schraubendetails | Nice ✓ |
| 1.9 | Reale Werkzeugfunktion | Greifer-Backen mit `mimic`-Joint + F/T-Sensor, Zementdüse mit Particle-Emitter | Nice ✓ |
| 2.1 | 2 Roboter interagieren | Bot A pickt Brick von Palette → Übergabe → Bot B mauert; oder alternierende Courses | Must ✓ |
| 2.2 | Industrieller Kontext | Automatisierter Mauerbau (Hadrian X als Vorbild, reales Produkt) | Must ✓ |
| 2.3 | Wirtschaftlich sinnvoll | Baustellen-Automation, Fachkräftemangel Bau — dokumentiert in PDF | Must ✓ |
| 2.4 | Industrielles Umfeld | Baustellen-Welt: EuroPaletten + Bricks + Förderband + Schutzzaun + Warnlichter + Werkbank | Nice ✓ |
| 2.5 | Sensoren/Aktoren | RGBD-Cam TCP, 2D-Lidar Base, IMU, F/T am Tool-Flansch, Kontakt-Sensor Greifer | Nice ✓ |
| 2.6 | KI-Anwendung | **LLM (Claude via MCP) plant Missionen** + **CNN (YOLOv8) erkennt Brick-Posen** | Nice ✓✓ |
| 3.1 | Sim-Umgebung mit beiden Robotern | Gazebo Harmonic, beide Bots gleichzeitig | Must ✓ |
| 3.2 | HMI bewegt TCP linear (IK) | MoveIt2-Servo Cartesian-Jog via HMI-Buttons + Gamepad | Must ✓ |
| 3.3 | Start-Skript | `./start.sh` → `docker compose up` + `ros2 launch vika_bringup full_demo.launch.py` | Must ✓ |
| 3.4 | GUI-HMI | Vite+React+shadcn+three.js = Web-GUI (übererfüllt Tkinter/QT-Level) | Nice ✓✓ |
| 4.1 | Dokumentation PDF | Sphinx → LaTeX → PDF, CI-generiert | Must ✓ |
| 4.2 | Methodische Code-Doku | Docstrings + Sphinx `autodoc` für Python, Doxygen für C++ | Nice ✓ |
| 4.3 | Renderbilder | Gazebo `gz sim --headless` + screenshot-pipeline, plus Blender-Renders aus URDF | Nice ✓ |
| 4.4 | ReadTheDocs-style | Sphinx mit `sphinx-rtd-theme`, auf GitHub Pages deployed | Nice ✓ |

**Bonus über Angabe hinaus:** Digital Twin im HMI, Multi-Robot-Coordination, Teleop-Modus, Mission-BT mit Groot-Viz, MCP-Welt-Prompting.

---

## 3. Industrielles Szenario

**"Modular Masonry Automation Cell"** — Zwei autonome Kettenfahrzeuge bauen eine Mauer in einer abgesperrten Baustellen-Zelle:

1. **Palette** mit 20 Bricks steht am Rand
2. **Bot A** fährt zur Palette, pickt Brick mit Greifer, fährt zur Übergabe-Zone
3. **Bot B** nimmt Brick per Tool-Changer-Handshake entgegen (oder direkt von Bot-A-Greifer)
4. **Bot A** wechselt Tool zu Zementdüse, appliziert Zement-Bead auf aktueller Wand-Oberkante
5. **Bot B** platziert Brick präzise mit 6DOF-IK auf Zement-Bead
6. Rollen können pro Course getauscht werden (Bot A+B sind identisch → echte Kooperation)
7. Loop bis Mauer (4 Courses × 5 Bricks) fertig
8. **CNN** verifiziert Brick-Pose nach Placement (RGBD-Cam am platzierenden TCP)
9. **LLM** kann die Welt per MCP umkonfigurieren ("spawn extra pallet at (3,2)", "add 10 bricks")

**Referenz real:** FBR Hadrian X, Construction Robotics SAM100.

---

## 4. System-Architektur

### 4.1 Datenfluss

```
  Windows Browser (Vite + React + three.js + shadcn)
    │  WebSocket :9090 (roslibjs)
    ▼
  WSL2 Docker: rosbridge_server (--net=host)
    │  DDS
    ▼  ┌─────────────────────────────────────┐
    │  │ ROS2 Jazzy Nodes (Docker)           │
    │  │  - MoveIt2 (A + B, namespaced)      │
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
│   │   ├── arm_6dof.xacro                # Knickarm RRR-RRR
│   │   ├── tool_gripper.xacro
│   │   ├── tool_cement.xacro
│   │   ├── tool_changer.xacro
│   │   └── vika.urdf.xacro           # Komposition (mit ${prefix}-Arg für Namespace)
│   ├── meshes/                          # STL/DAE aus Fusion360/FreeCAD
│   └── rviz/view_robot.rviz
│
├── vika_gazebo/             # Welten + Plugin-Config
│   ├── worlds/construction_site.sdf
│   ├── models/brick/
│   ├── models/europallet/
│   ├── models/conveyor_belt/
│   ├── models/safety_fence/
│   ├── models/warning_light/
│   ├── config/bridge_config.yaml
│   └── launch/spawn_world.launch.py
│
├── vika_moveit/             # MoveIt2 config (6DOF, zweimal instanziiert mit Namespaces robot_a/robot_b)
│
├── vika_control/
│   ├── config/controllers.yaml
│   └── launch/controllers.launch.py
│
├── vika_mission/            # Mission BT + actions
│   ├── bt_trees/build_wall.xml
│   ├── src/bt_nodes/*.cpp
│   └── action/PickBrick.action, PlaceBrick.action, ApplyCement.action
│
├── vika_perception/         # YOLOv8 brick detector
│   ├── vika_perception/cnn_brick_detector.py
│   ├── models/brick_yolov8n.onnx
│   └── launch/perception.launch.py
│
├── vika_teleop/             # Joy + HMI teleop bridge
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
│   ├── launch/full_demo.launch.py       # single-entry, startet alles
│   ├── launch/single_robot.launch.py
│   └── config/sim_params.yaml
│
└── vika_docs/               # Sphinx source
    ├── conf.py
    ├── index.rst
    └── pdf-build.sh → LaTeX → PDF

vika-hmi/                    # SEPARATES Repo, Vite Web-App
├── src/
│   ├── scene/UrdfTwin.tsx       # three.js + urdf-loader live joint_states
│   ├── scene/BrickWorld.tsx     # Digital Twin der Welt
│   ├── ros/useRos.ts            # roslibjs hook
│   ├── ros/useTopic.ts
│   ├── ros/useService.ts
│   ├── panels/TcpJogPanel.tsx   # XYZ linear jog (IK Pflicht!)
│   ├── panels/RobotSelector.tsx
│   ├── panels/MissionPanel.tsx  # Start/Pause/Abort + BT-Status
│   ├── panels/SensorPanel.tsx   # Cam-Feed + Lidar-Scan + F/T
│   ├── panels/TeleopPanel.tsx   # Virtual Joystick
│   ├── panels/WorldPromptPanel.tsx  # LLM chat → MCP
│   └── App.tsx
├── vite.config.ts
└── package.json

docker/
├── Dockerfile.ros               # osrf/ros:jazzy-desktop + deps
├── Dockerfile.perception        # CUDA + torch + ultralytics
└── docker-compose.yml

start.sh                         # Top-level launch-Skript (Pflicht Z.88)
README.md                        # Setup-Doku (Pflicht Z.94)
```

---

## 5. Roboter-Konstruktion (Detail)

### 5.1 Gemeinsame Base — Tracked Mobile Platform
- **Fußabdruck:** 1.2m × 0.8m × 0.4m
- **Antrieb:** 2 Ketten (Gazebo `TrackController`-Plugin; Fallback `DiffDrive` mit animiertem Track-Mesh)
- **Masse:** ~180 kg (realistisch für Kettenfahrzeug dieser Größe, Inertia-Tensor aus CAD)
- **Joints:** 2× continuous (left_track, right_track) + 2× cosmetic-mimic für sichtbare Sprockets
- **Sensoren:** 2D-Lidar vorn (Sick-TiM-Style, 270°), IMU mittig, Stoßfänger-Kontakt
- **Visual:** graue Stahlstruktur mit gelbem Warnstreifen, Warnleuchte oben

### 5.2 Elias' Arm — 6-DOF Knickarm (Pick & Place)
- **Autor:** Elias Bitsch
- **Kinematik:** klassisch RRR-RRR (Shoulder + Elbow + 3-DOF Spherical Wrist)
- **Reichweite:** 1.4 m
- **Traglast:** 7 kg (Brick ~3 kg + Tool-Changer + Greifer mit Reserve)
- **Joints (Limits/Torques realitätsnah, angelehnt an KUKA-KR6-Klasse — Größen als Referenz, Geometrie selbst):**
  - J1 (Base): ±185°, 80 Nm
  - J2 (Shoulder): -155..+35°, 80 Nm
  - J3 (Elbow): -130..+154°, 60 Nm
  - J4 (Wrist Roll): ±350°, 20 Nm
  - J5 (Wrist Pitch): ±130°, 20 Nm
  - J6 (Tool Rot): ±350°, 15 Nm
- **Detailgrad (Z.59):** sichtbare Harmonic-Drive-Dummies an J2/J3, externer Kabelkanal-Mesh entlang Oberarm
- **Rolle:** Pick (top-down von Palette), Übergabe, Place (schräg möglich dank voller 6-DOF-Orientierung)
- **Endeffektor:** Parallelbackengreifer (siehe 5.4)

### 5.3 Viktoriias Arm — 5-DOF mit Zementdüse (Linien-Applikation)
- **Autor:** Viktoriia Ovdiienko
- **Kinematik:** 5-DOF seriell (RRR-Schulter/Ellbogen + 2-DOF-Handgelenk) — **bewusst eine Achse weniger**: für das Abfahren einer Zement-Linie ist die Rotation um die Düsen-Längsachse (J6) funktionslos und entfällt. Saubere, eigenständige Kinematik (nicht Elias' Arm minus eine Achse — eigene Geometrie/Maße).
- **Reichweite:** 1.5 m (etwas länger, um über die Wand-Oberkante zu reichen)
- **Traglast:** 5 kg (Düse + Tool-Changer + Zement-Reserve)
- **Joints:**
  - J1 (Base): ±185°, 80 Nm
  - J2 (Shoulder): -150..+40°, 80 Nm
  - J3 (Elbow): -125..+150°, 55 Nm
  - J4 (Wrist Pitch): ±130°, 20 Nm
  - J5 (Wrist Yaw / Düsen-Anstellwinkel): ±180°, 15 Nm
- **Rolle:** fährt die aktuelle Wand-Oberkante als kartesischen **Linienzug** ab (MoveIt2 Cartesian-Path) und extrudiert dabei den Zement-Bead. 5-DOF reicht, weil die Düse rotationssymmetrisch ist.
- **Endeffektor:** Zementdüse (siehe 5.4)

### 5.4 Tool-Changer + Endeffektoren
- **ISO-Style Kupplung** (Schrenk-Style): pneumatischer Snap via `fixed_joint` spawn/despawn zur Laufzeit
- **Tool 1 — Parallelbackengreifer:**
  - 2× prismatic (mimic-joint für symmetrisches Schließen)
  - `ros2_control` `gripper_action_controller`
  - F/T-Sensor am Flansch
  - Kontakt-Sensor in Backen (Gazebo `ContactSensor`) → Grasp-Confirmation
- **Tool 2 — Zementdüse:**
  - Revoluter Düsenkopf (1 DOF für Applikationswinkel)
  - Gazebo-Particle-Plugin-Emitter (visueller Zement-Strang)
  - Aktivierung via ROS-Service `/tool/cement/extrude`
  - "Kleber"-Logik: nach Cement-Bead werden platzierte Bricks via `attach_link` service an Wall-Link fixiert

---

## 6. Umgebung & Assets (angabe.md Z.70-72)

| Asset | Quelle | Zweck |
|---|---|---|
| EuroPalette (1200×800) | Fuel + eigene Textur | Brick-Source |
| Brick (240×115×71 mm) | eigenes SDF, 20× auf Palette | Werkstück |
| Wand-Zone-Markierung | eigene SDF (Bodenmarker) | Ziel-Area |
| Schutzzaun | Fuel `safety_fence` + extend | Industrielles Umfeld |
| Förderband | Fuel `conveyor` oder eigenes | Brick-Nachschub (Stretch) |
| Warnleuchte | eigene SDF + light-source | Aktiv bei Roboter-Motion |
| Werkbank + Toolbox | Fuel | Ambient-Deko |
| Staub/Partikel-FX | Gazebo Particle | Realismus |
| Skybox + Boden-Textur | Beton-PBR | Industrial look |

Quellen: [Gazebo Fuel](https://app.gazebosim.org/fuel/models), [3DGEMS 270+ Models](https://data.nvision2.eecs.yorku.ca/3DGEMS/), [gazebo_models_worlds_collection](https://github.com/leonhartyao/gazebo_models_worlds_collection).

---

## 7. HMI-Features (Web-GUI)

| Panel | Funktion | ROS-Interface |
|---|---|---|
| Robot Selector | A / B / Both | client-state |
| 3D Digital Twin | three.js Scene mit beiden URDFs, animiert von `/joint_states` | `roslibjs` topic |
| **TCP Linear Jog** (Pflicht!) | ±X/±Y/±Z Buttons, Step-Size-Slider | Service `/move_tcp_linear` (MoveIt2 Cartesian) |
| TCP Pose Display | Live-Pose readout | `/tf` |
| Teleop Joystick | Base-Fahrt via virtuellem Joystick | `/cmd_vel` |
| Gripper Control | Open/Close + Force-Slider | Action `gripper_cmd` |
| Tool Swap | Dropdown Gripper/Cement | Service `/tool/swap` |
| Mission Panel | Start/Pause/Abort, BT-State, Phasen-Fortschritt | Action `/mission/build_wall` |
| Sensor Panel | Live-Cam (web_video_server), Lidar 2D-Plot, F/T-Gauge, IMU | topics |
| CNN-Overlay | Brick-Detection-BBoxes auf Cam-Feed | `/perception/detections` |
| **World Prompt Panel** | Chat-Input → schickt an MCP → Claude modifiziert Welt live | custom WS |
| Logs + BT-Viz | rosout filtered + Groot2 embed | `/rosout` |
| **Google 3D Tiles Ground** | Photorealistic 3D Tiles (Google Maps API) als Hintergrund der Twin-Scene, Baustelle georeferenziert auf echte Koordinaten | `3d-tiles-renderer` npm |
| **Wall-Drawing (iPad-ready)** | Touch-Polyline auf Grid-Overlay (Top-Down oder Perspective), "Plan Wall" samplet Linie → Brick-Positionen → Mission-Start | Action `/mission/build_custom_wall` (geometry_msgs/Polygon) |

---

## 8. KI-Integration (Bonus, angabe.md Z.74)

### 8.1 LLM steuert Roboter (via MCP)
- Python MCP-Server (`vika_mcp/server.py`) exponiert Tools:
  - `spawn_model(uri, pose)` / `delete_model(name)` / `list_models()`
  - `set_model_pose(name, pose)` / `attach_link(parent, child)`
  - `get_sensor(topic, timeout)` mit Server-seitigem Filter (95% Token-Ersparnis)
  - `mission_start(plan_yaml)` / `mission_abort()`
  - `move_tcp(robot, xyz, rpy)` (ruft MoveIt2 action)
- Claude Desktop oder Claude Code spricht direkt MCP → Welt-Prompting:
  > "Spawn 5 extra bricks random auf der Palette und start build_wall mission"

### 8.2 CNN Computer Vision
- **YOLOv8-nano** auf eigenem Brick-Dataset (~500 synth. Bilder aus Gazebo Headless-Render, Label aus known-truth-poses)
- Inference-Node `cnn_brick_detector.py` subscribed `/robot_b/wrist_camera/image_raw`, published `/perception/detections` (vision_msgs/Detection3DArray)
- Mission-BT nutzt Detections für Fine-Placement-Correction vor jedem Place

---

## 9. Start-Skript (angabe.md Z.88)

**`./start.sh`:**
```bash
#!/usr/bin/env bash
set -e
xhost +local:docker          # für Gazebo GUI aus Docker (optional — Gazebo läuft nativ)
docker compose -f docker/docker-compose.yml up -d ros_jazzy perception
wsl.exe -d Ubuntu -- bash -c "gz sim -r vika_gazebo/worlds/construction_site.sdf" &
sleep 5
docker compose exec ros_jazzy bash -c \
  "source /opt/ros/jazzy/setup.bash && source install/setup.bash && \
   ros2 launch vika_bringup full_demo.launch.py"
# HMI separat:
( cd vika-hmi && pnpm dev ) &
```

---

## 10. Dokumentation (angabe.md Z.91-101)

- **Sphinx** Workspace mit `sphinx-rtd-theme` → build-pipeline:
  - `autodoc` für Python (vika_mcp, vika_perception)
  - `breathe + doxygen` für C++ (BT-Nodes)
  - Kapitel: Einleitung / Industrielles Szenario / Roboterkonstruktion / Simulation / HMI / KI-Module / Installation / Launch-Anleitung / API-Ref
  - **PDF via LaTeX** (`make latexpdf`) — Pflicht Z.97
  - HTML auf GitHub Pages (Bonus Z.101)
- **Renderbilder:** Gazebo `gz sim --headless-rendering` + Python-Screenshot-Skript für 6 Key-Posen
- **Backup-Video:** OBS-Aufnahme der Live-Demo für Zwischen- und Endpräsentation
- **IMRAD-strukturierte Präsentationen** (Z.110): Introduction / Methods / Results / Discussion

---

## 11. Phasen-Roadmap (für spätere Execution)

Owner-Legende: **Elias** (6-Achs-Arm + Pick&Place) · **Viktoriia** (5-Achs-Arm + Düse/Linie) · **Beide** (geteilte Infrastruktur).

| # | Phase | Deliverable | Owner |
|---|---|---|---|
| 1 | Bootstrap | WSL2 + Docker-Images + colcon ws + Vite skeleton | Beide |
| 2 | Base URDF | Tracked Base fährt in Gazebo via `ros2 topic pub /cmd_vel` | Beide |
| 3a | Arm 6-DOF URDF | xacro + MoveIt2 config + IK in RViz (Pick&Place-Arm) | **Elias** |
| 3b | Arm 5-DOF URDF | xacro + MoveIt2 config + Cartesian-Path in RViz (Düsen-Arm) | **Viktoriia** |
| 4a | Greifer + Changer | Parallelbackengreifer + Tool-Swap-Service | **Elias** |
| 4b | Zementdüse + Changer | Düsenkopf + `/tool/cement/extrude`-Service | **Viktoriia** |
| 5 | World Assets | Palette + 20 Bricks + Fence + Förderband + Warnlicht | Beide |
| 6 | HMI MVP | Vite + shadcn + rosbridge + URDF-Twin + `/joint_states` live | Beide |
| 7 | HMI TCP-Jog | Servo Cartesian via Buttons → IK bewegt TCP linear (Pflicht!) | Beide |
| 8 | Pick/Place One-Shot | Elias-Arm pickt einen Brick, platziert auf Wand | **Elias** |
| 9 | Cement-Line One-Shot | Viktoriia-Arm fährt Linie + extrudiert Zement-Bead | **Viktoriia** |
| 10 | Mission BT | build_wall.xml — komplette kooperative Sequence | Beide |
| 11 | Multi-Robot | Beide Bots in einer Welt (Namespaces), Übergabe funktioniert | Beide |
| 12 | Cement FX | Particle-Emitter + Wand-Attachment | **Viktoriia** |
| 13 | Teleop | Joy-Node + HMI-Joystick | **Elias** |
| 14 | MCP-Server | Python Tools + Claude spawn-test | **Viktoriia** |
| 15 | CNN Perception | YOLOv8 Training + Inference-Node + HMI-Overlay | **Elias** |
| 16 | Sensor Suite | RGBD + Lidar + F/T + IMU + Kontakt verdrahtet | Beide |
| 17 | Polish & Docs | Sphinx → PDF, Renderbilder, Doku, Backup-Video | Beide |
| 18 | Dry-Run Präsentation | End-to-End Demo funktioniert reproduzierbar | Beide |
| 19 | **Google 3D Tiles Ground** | HMI-Scene lädt Photorealistic 3D Tiles via `3d-tiles-renderer`, Baustelle georeferenziert | **Elias** |
| 20 | **iPad Wall-Drawing** | Touch-Polyline auf Grid-Overlay → Sample zu Brick-Positionen → Action `/mission/build_custom_wall` → BT baut maßgeschneiderte Mauer | Beide |

---

## 12. Kritische Dateien (zu erstellen)

| Pfad | Zweck |
|---|---|
| `vika_ws/src/vika_description/urdf/vika.urdf.xacro` | Komposition (Namespace via `${prefix}` arg für robot_a / robot_b) |
| `vika_ws/src/vika_description/urdf/arm_6dof.xacro` | 6-DOF Knickarm |
| `vika_ws/src/vika_gazebo/worlds/construction_site.sdf` | Welt |
| `vika_ws/src/vika_mission/bt_trees/build_wall.xml` | BehaviorTree |
| `vika_ws/src/vika_mcp/vika_mcp/server.py` | MCP-Server |
| `vika_ws/src/vika_perception/vika_perception/cnn_brick_detector.py` | YOLOv8 Node |
| `vika_ws/src/vika_bringup/launch/full_demo.launch.py` | Top-level launch |
| `vika-hmi/src/panels/TcpJogPanel.tsx` | **Pflicht-Feature** TCP-Linear-Jog |
| `vika-hmi/src/scene/UrdfTwin.tsx` | Digital Twin |
| `vika-hmi/src/scene/GoogleTilesGround.tsx` | Photorealistic 3D Tiles Layer |
| `vika-hmi/src/panels/WallDrawPanel.tsx` | Touch-Polyline → Wall-Plan (iPad-Killer-Feature) |
| `vika_ws/src/vika_mission/src/wall_sampler.py` | Polyline→Brick-Positions-Sampler + Action-Server |
| `docker/docker-compose.yml` | Reproduzierbare Runtime |
| `start.sh` | Single-Skript-Launch (Pflicht) |
| `vika_docs/conf.py` | Sphinx PDF-Build |
| `README.md` | Installations-/Launch-Doku |

---

## 13. Verification / Live-Demo-Szenario

1. `wsl --distribution Ubuntu-24.04`
2. `./start.sh` im Repo-Root
3. Gazebo öffnet Baustellen-Welt mit beiden Bots, Palette, Fence
4. Browser auf `http://localhost:5173` → HMI lädt, 3D-Twin zeigt beide Bots sync mit Gazebo
5. HMI → **TCP-Jog-Panel**, Robot B auswählen, ±X-Button → TCP bewegt sich linear 5cm (IK-Pflichtnachweis ✓)
6. HMI → **Teleop-Panel** → virtueller Joystick → Bot A fährt manuell
7. HMI → **Mission-Panel** → "Start build_wall" → vollständiger Ablauf:
   - Bot A pickt Brick → Übergabe → Bot B platziert → Zement-Bead → next
8. HMI → **Sensor-Panel** zeigt Live-Cam, Lidar, CNN-BBox-Overlay
9. HMI → **World-Prompt-Panel**: Text "spawn 3 bricks at random poses" → Claude via MCP → Bricks erscheinen in Sim
10. Mauer fertig (4 Courses × 5 Bricks) → Success-State
11. **Killer-Demo:** iPad öffnet `http://<wsl-ip>:5173` → User zeichnet L-förmige Linie auf Grid-Overlay (Google 3D Tiles Hintergrund zeigt echte Umgebung) → "Plan Wall" → Bots bauen exakt diese Mauer

**Acceptance je Phase:** `colcon build` ohne Errors, `colcon test` grün, HMI-Panels ohne Browser-Console-Errors.

---

## 14. Offene Risiken + Mitigationen

| Risiko | Mitigation |
|---|---|
| `TrackController` in Harmonic instabil | Fallback `DiffDrive` + cosmetic Track-Mesh |
| Particle-FX für Zement limitiert | Fallback: animiertes Mesh-Extrusion als Zement-Bead |
| 2 MoveIt2-Instanzen im selben Master | Getrennte Namespaces `/robot_a` `/robot_b`, früh testen |
| DDS Docker→nativ über `--net=host` | Alternative: rosbridge komplett in Container |
| CNN-Training-Zeit | Synthetic Data aus Gazebo + Transfer-Learning von YOLOv8n |
| "Gleiche Kinematik"-Konflikt (angabe Z.56) | **Top-Risiko** — Gruppe baut bewusst identische Bots. Sofort im ersten Termin mit Lehrkraft klären. Fallback: einer der beiden switched auf SCARA+Z-Spindel (Phase 3/4 getrennt) |
| Zeit-Budget (SS2026) | Strikte Phasen-Roadmap, MVP-first, Nice-to-Haves als letzte Phase |

---

## 15. Quellen

- [Gazebo Fuel model library](https://app.gazebosim.org/fuel/models)
- [Gazebo Small Warehouse worlds](https://discourse.openrobotics.org/t/gazebo-small-warehouse-bookstore-and-small-house-worlds-available-for-simulation/14915)
- [3DGEMS 270+ Gazebo SDF models](https://data.nvision2.eecs.yorku.ca/3DGEMS/)
- [Community Gazebo MCP Server](https://lobehub.com/mcp/yourusername-gazebo-mcp)
- [Gazebo Harmonic Sensors + Plugins](https://medium.com/@alitekes1/gazebo-sim-plugin-and-sensors-for-acquire-data-from-simulation-environment-681d8e2ad853)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [FBR Hadrian X — reales Vorbild](https://www.fbr.com.au)
- [rosbridge_suite docs](https://github.com/RobotWebTools/rosbridge_suite)
- [MoveIt2 Servo Cartesian Jog](https://moveit.picknik.ai/main/doc/examples/realtime_servo/realtime_servo_tutorial.html)
- [Google Photorealistic 3D Tiles API](https://developers.google.com/maps/documentation/tile/3d-tiles-overview)
- [3d-tiles-renderer (NASA-AMMOS, three.js)](https://github.com/NASA-AMMOS/3DTilesRendererJS)

---

## 16. Installation & Quickstart

**Voraussetzungen:**
- Windows 11 mit **WSL2 Ubuntu 24.04**
- **Docker Desktop** (oder Docker Engine in WSL2)
- **Node 22+** und **pnpm 10+** auf Windows (für HMI-Dev-Server)
- **Gazebo Harmonic** nativ in WSL2:
  ```bash
  # in WSL2
  sudo apt update && sudo apt install -y gz-harmonic
  ```

**Erstmaliges Setup:**
```bash
# 1. ROS-Image bauen
docker compose -f docker/docker-compose.yml build

# 2. HMI-Deps installieren (auf Windows)
cd vika-hmi && pnpm install && cd ..
```

**Starten:**
```bash
./start.sh
```
Öffnet:
- HMI: http://localhost:5173
- rosbridge: ws://localhost:9090
- natives Gazebo-Fenster

**Repo-Layout:**
```
vika_ws/        colcon workspace (ROS 2 Pakete)
vika-hmi/       Vite Web-HMI
vika_docs/      Sphinx-Dokumentation
docker/         Docker-Image + compose
start.sh        Single-Entry Launch-Skript
angabe.md       Aufgabenstellung (Course brief)
plan.md         Projektplan (Source of Truth)
HANDOFF.md      Session-Übergabe / aktueller Stand
```

---

## 17. Mesh Drop-in Konvention (Arm-Meshes)

Im Ordner `vika_ws/src/vika_description/meshes/arm/` liegen STL/DAE-Dateien mit **exakt diesen Dateinamen**. Das Launch-File erkennt jede automatisch und ersetzt das jeweilige Primitiv; was nicht abgelegt ist, bleibt Box/Zylinder.

| Dateiname        | Ersetzt (Link)   | Primitiv-Fallback              |
|------------------|------------------|--------------------------------|
| `base_link.stl`  | `arm_base_link`  | cylinder r=0.12, h=0.15        |
| `link1.stl`      | `arm_link1`      | box 0.18 × 0.18 × 0.25         |
| `link2.stl`      | `arm_link2`      | box 0.12 × 0.14 × 0.55         |
| `link3.stl`      | `arm_link3`      | box 0.10 × 0.12 × 0.45         |
| `link4.stl`      | `arm_link4`      | cylinder r=0.05, h=0.12        |
| `link5.stl`      | `arm_link5`      | box 0.08 × 0.08 × 0.08         |
| `tool0.stl`      | `arm_tool0`      | cylinder r=0.035, h=0.04       |

**Authoring-Regeln:** Mesh-Origin (0,0,0) = URDF-Link-Frame (Joint am Parent-Ende), Z nach oben, Meter. Das im xacro hinterlegte `<origin>`-Offset wird zusätzlich angewandt — entweder Mesh verschoben re-modellieren oder den per-Link-`<origin>`-Block in `arm_6dof.xacro` anpassen. STLs in mm → in Meter re-exportieren oder am `<mesh>`-Element skalieren. Dieselbe Datei dient als Collision; für High-Poly-Visuals separate vereinfachte Collision-STL erwägen.

**Drop-in verifizieren:**
```bash
cp my_link2.stl meshes/arm/link2.stl
colcon build --packages-select vika_description
ros2 launch vika_bringup arm_demo.launch.py
```
