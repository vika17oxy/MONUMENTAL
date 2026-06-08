# MONUMENTAL — Handoff

Stand: 2026-05-05, kurz vor Demo-Tag. Übergabe an die nächste Claude-Session.

## Was ist das Projekt
6-DOF Bauroboter "V.I.K.A." (Virtual Industrial robot Arm) der Mauerziegel von einer Euro-Palette nimmt und eine Wand baut. Demo morgen früh (MRE2 Zwischenpräsentation, FHTW SS2026). Tagline: "Draw a wall. Watch it rise."

## Hardware/Software-Stack
- WSL2 Ubuntu 24.04 + Docker Desktop
- Native Gazebo Harmonic (über WSLg GPU-Passthrough via `/dev/dxg`)
- Docker container `vika_ros` (ROS 2 Jazzy, MoveIt 2, gz_ros2_control)
- React/Vite HMI (port 5173, lokal nativ)
- Fusion 360 + MCP-Plugin (port 27182) für CAD-→-URDF-Pipeline

## Aktueller Stand (was funktioniert)

### ✅ Hochgradig stabil
- **URDF aus Fusion via MCP** generiert — kein xacro-Geraten mehr. Component-Posen werden aus dem aktiven assembly v17 gelesen, daraus joint origins + rpy berechnet
- **6-DOF Kinematik**: alle 6 Joints korrekt verkettet, Gripper angeflanscht, TCP-Frame definiert
- **MoveIt + RViz** mit interactive marker (gizmo ball), Planning Group `arm`, OMPL planner
- **Gazebo + ros2_control + MoveIt-Kette**: gz_ros2_control plugin lädt, controller_manager spawnt joint_state_broadcaster + arm_controller, MoveIt commandet Gazebo via FollowJointTrajectory
- **Pallet + 6 Bricks** in Gazebo (visual + collision); Pallet auch als Collision-Object in MoveIt-Scene (sichtbar in RViz)
- **Zweiter Roboter "vika_5"** als Twin spawned in Gazebo, gleicher URDF aber mit `vika_5_`-Prefix programmatisch im Launch (regex im Python launch file)

### ⚠️ Halb-funktioniert / fragil
- **TCP-Orientation**: TCP-Frame zeigt nicht "intuitiv" nach unten. IK mit "Z-down"-constraint scheitert oft. Workaround: position-only IK ohne orientation, akzeptiere natürliche Pose. Sauberer Fix wäre `gripper_to_tcp` rpy korrekt setzen aber war nicht trivial.
- **`build_wall.py` Pick&Place**: Pick (hover über Brick) klappt sporadisch. Place ist instabil — meist `START_STATE_IN_COLLISION` oder `PLANNING_FAILED`. `force_home()` zwischen jedem Brick hilft. Robot ist VIEL zu groß (5m+ Reichweite) für die Brick-Distanzen, IK ist constraint-arm.
- **Twin-Robot in RViz**: TF-Frames mit `vika_5_`-Prefix werden published, joint_state_publisher mit `publish_default_positions:true` läuft. Letzter Stand vor Übergabe: meshes laden, TF kommt durch (regex bug `(?<![\w])` Lookbehind war der Fix), aber erforderte `bash scripts/stop.sh && bash scripts/start-full.sh` für Effekt.

### ❌ Nicht angegangen
- HMI ↔ ROS-Verbindung (rosbridge, line-drawing → mission topic)
- "Wall-Building"-Animation als komplette Demo-Choreografie
- Octomap / Sensor-Pipeline
- Real-Hardware-Anbindung

## Wichtige Dateien

```
vika_ws/src/
├── vika_description/
│   ├── urdf/base_only.urdf.xacro    ← KERN-URDF, MCP-generated, sim_mode arg (mock|gazebo|passive)
│   ├── meshes/arm/ROD-STL/*.stl     ← STLs aus Fusion (base, link1..link6, gripper, brick)
│   ├── launch/view_base.launch.py   ← Standalone RViz-Viewer (nur RobotModel)
│   └── rviz/view_base.rviz          ← Custom rviz config mit World Axes
├── vika_moveit/
│   ├── config/
│   │   ├── vika.srdf                        ← Planning groups: "arm", "gripper", end_effector
│   │   ├── vika_kinematics.yaml             ← KDL solver
│   │   ├── vika_joint_limits.yaml           ← j1..j6 vel/accel
│   │   ├── vika_ros2_controllers.yaml       ← arm_controller (JointTrajectoryController)
│   │   └── vika_moveit_controllers.yaml     ← MoveIt → controller mapping
│   ├── launch/
│   │   ├── vika_moveit.launch.py    ← MoveIt only (mock_components)
│   │   └── vika_full.launch.py      ← MoveIt + Gazebo + Twin (HAUPTLAUNCH)
│   └── scripts/
│       ├── publish_scene.py    ← Pallet als CollisionObject in MoveIt-Scene
│       ├── goto_brick.py       ← MIN-Test: home + ein Brick anfahren
│       └── build_wall.py       ← 6-Brick Pick&Place Choreo (fragil)
└── vika_gazebo/
    ├── worlds/construction_site.sdf  ← Welt mit Pallet + 6 Bricks (visual)
    └── launch/spawn_robot.launch.py  ← (älter, nicht in Verwendung)

scripts/
├── start-full.sh         ← MASTER: Container recreate + Gazebo + ROS-stack
├── start-moveit.sh       ← MoveIt only ohne Gazebo
├── start-gazebo.sh       ← Gazebo only (älter, vor docker-integration)
├── stop.sh               ← Killt alles (Container + Host)
├── kill-all.sh           ← Aggressiver kill
├── view-arm.sh           ← Standalone view (URDF-Watcher Mode)
└── start.sh              ← View mit URDF-Hot-Reload-Watcher

docker/docker-compose.yml ← Container `vika_ros` mit:
                            - user 1000:1000 (matcht Host für gz IPC)
                            - /dev/dxg + /usr/lib/wsl + /mnt/wslg (GPU-Passthrough)
                            - GZ_PARTITION=vika, GZ_IP=127.0.0.1
                            - ROS_DOMAIN_ID=42
```

## Demo-Workflow (start-from-zero)

```bash
# 1. Start everything
bash scripts/stop.sh
bash scripts/start-full.sh
# → Gazebo öffnet (Pallet + Bricks + 2 Roboter), RViz öffnet (MotionPlanning + 1 Roboter primär)

# 2. Pallet-Scene-Publisher läuft auto (5s nach Start)
# → Pallet erscheint als grünes Hindernis in RViz

# 3. (Optional) Pick&Place demo
docker exec -it vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  source /ws/install/setup.bash
  export ROS_DOMAIN_ID=42
  ros2 run vika_moveit build_wall.py
'
# → Robot fährt 6 Bricks ab. Erfolg unzuverlässig.

# 4. Einzelnes hover-pose Demo (zuverlässiger):
docker exec -it vika_ros bash -lc '... ros2 run vika_moveit goto_brick.py'

# 5. RViz Gizmo manuell:
# In RViz: MotionPlanning → drag den Ball → "Plan & Execute". Funktioniert robust.
```

## Bekannte Stolperfallen

1. **Container muss neu gestartet werden** wenn `docker-compose.yml` geändert wird (`docker compose down`)
2. **Gazebo-Mesh-Pfade** brauchen `GZ_SIM_RESOURCE_PATH=/ws/src:/ws/install/vika_description/share:/ws/install/vika_gazebo/share` (parent-of-package, sonst `model://vika_description/...` resolved nicht)
3. **gz_ros2_control plugin** heißt `gz_ros2_control::GazeboSimROS2ControlPlugin` (NICHT `...System`)
4. **Twin-URDF-Prefixing** im Launch: regex `(?<![\w])(name|link|parent|child|reference)="..."` mit Lookbehind, sonst matcht es auch `filename="..."`
5. **`/run/user/1000` Mount** in compose ist wichtig für gz-transport-Sockets damit Container und Native Gazebo kommunizieren (auch wenn aktuell beide IM Container laufen)
6. **Native ROS 2 Jazzy in WSL ist kaputt** (fastcdr ABI mismatch in moveit-msgs / controller-manager-msgs). Daher MUSS alles ROS-related im Docker laufen. `ros2 run` ist nativ nicht verfügbar.
7. **JointTrajectoryController bypass für home-pose** (`force_home()` in build_wall.py): geht direkt über `/arm_controller/follow_joint_trajectory` action, umgeht MoveIt collision check

## MCP-Workflow für URDF-Updates aus Fusion

In Fusion: Component-Position bewegen / Origin neu setzen → STL re-export ins ROD-STL Verzeichnis. Dann:

```python
# MCP Read Component-Posen (assembly v17)
# → Berechne joint origin xyz + rpy in parent-frame
# → Update vika_description/urdf/base_only.urdf.xacro
# → Restart: bash scripts/stop.sh && bash scripts/start-full.sh
```

Der Workflow ist im Chat-Verlauf gut dokumentiert: für jeden link wurde ein dedizierter MCP-script-call gemacht der xyz und rpy als Quaternion-decomposition lieferte.

## Empfehlungen für die nächste Session

**Priorität 1 — Demo-Robustheit:**
- `goto_brick.py` als verlässliches Demo-Asset polieren (hover → home → hover)
- Skip `build_wall.py` für die Demo, zu fragil. Stattdessen 2-3 manuell-getriggerte gizmo-pose Sequenzen vorbereiten

**Priorität 2 — Wenn Zeit:**
- `gripper_to_tcp` URDF-rpy fixen damit TCP-Z natürlich nach unten zeigt (siehe Chat um 11:00)
- Twin-Robot J4-only-fixed (rest revolute) braucht entweder static-Gravity oder JSP läuft schon — nur final test fehlte

**Priorität 3 — HMI-Integration:**
- HMI ist auf port 5173, läuft nativ als Vite. Hat WallDrawPanel. Topic-publishing via rosbridge fehlt komplett.

## Letzter offener Faden

Beim Übergabe-Zeitpunkt: User wollte Twin-Robot mit nur J4 fixed (statt all fixed) sehen. Letzter Edit war:
- `joint_state_publisher` im vika_5 namespace mit `publish_default_positions:true` zugefügt
- nicht final getestet ob TF + meshes nun komplett für Twin laden

Erste Aktion in nächster Session: `bash scripts/stop.sh && bash scripts/start-full.sh` und visuell prüfen.
