# VIKA – Prüfungs-Spickzettel

Mobiler Maurer-Roboter-Stack: ROS 2 Jazzy · MoveIt 2 · Gazebo Harmonic · Behavior Tree · Web-HMI.
Zwei Roboter auf gemeinsamer Schiene: **VIKA-6 = robot_a** (Greifer/Mauern), **VIKA-5 = robot_b** (Zementdüse).

---

## 1. Inverse Kinematik

- **Solver:** KDL — `kdl_kinematics_plugin/KDLKinematicsPlugin` (numerisch, Jacobian/Newton-Raphson).
  Config: `vika_moveit/config/robot_a_kinematics.yaml` — res 0.005, timeout 0.05 s, 3 Versuche.
- **Warum KDL?** Serieller, nicht-redundanter 6-DOF-Arm → keine Redundanz, TRAC-IK/IKFast unnötig.
- **Nachteil numerisch:** Seed-abhängig, Branch-Flips → fester Seed `[-0.02,-0.34,-0.78,-0.58,-0.01,-1.42]` (pick3_lift.py).
- **MoveL / Ablegen:** kartesisch via `compute_cartesian_path` (hmi_bridge.py:79-82); max_step 0.01 m, jump_threshold 0, Orientierung aus aktuellem TF. **Top-down**: erst hovern, dann gerader Z-Abstieg (seitlich verhakt an Nachbarsteinen).
- **Home j1 = 1.55 statt π/2:** exaktes Joint-Limit → MoveIt `CheckStartStateBounds` lehnt ab.

## 2. Ziegel-Attachment

- **Gazebo `DetachableJoint`-Plugin** (tool_gripper.xacro:108-118) — keine echte Saugphysik.
  Attach = fixer Joint `tool0`↔Ziegel; Topics `/suction/<row>/attach` & `/detach`.
- Trigger: `/hmi/suck` → Bridge published 3× `Empty` aufs Attach-Topic (gegen Message-Loss).
- Planer kennt Stein als **MoveIt AttachedCollisionObject** an `gripper_base`, Touch-Links `gripper_base, tool0, link6, link5`.
- **Warum?** Echte Kontaktphysik teuer/instabil; toggelbarer Constraint = selber Effekt, deterministisch.

## 3. URDF / Struktur

- Pro Roboter **7 Joints**: 1 prismatische Schiene (Achse Welt-Y, ≤3 m/s) + 6-DOF-Arm. Planungsgruppe = 6-DOF.
- Xacro-Module: `base_rail` + `arm_6dof` + Tool, zusammengesetzt in `vika.urdf.xacro`.
- Arm: j1 Base-Yaw ±π · j2/j3 Schulter/Ellbogen ±2.70 · j4 Wrist-Roll · j5 ±2.27 · j6 Tool-Roll.
  j4 frei bei VIKA-6 (war bei VIKA-5 gesperrt).
- Platzierung im URDF via `base_x`/`base_yaw`: robot_a x=-2.0/yaw=0, robot_b x=0.8/**yaw=π**.
- **robot_b IK-Tip = `robot_b_arm_cement_base`** (Handgelenk-Wurzel), NICHT Düsenspitze — sonst macht `cement_angle` die Gruppe 7-DOF-redundant (j4 zuckt). Düse ~0.31 m darunter → IK-Ziel = `top_z + 0.31`.

## 4. Behavior Tree (bt_node.py)

- Eigene Engine: Sequence/Fallback + Action/Condition, States IDLE/RUNNING/SUCCESS/FAILURE. Tree-State als JSON auf `/bt/state`.
- Ablauf (198-227): Park VIKA-5 → Pallet scannen → Steine detektieren → **∀ Kurs × Segment**: zur Palette → Pick-Row → Vakuum → heben → zum Segment → hovern (90°-Yaw) → gerade absenken → freeze+respawn → frei heben. **Nach jedem Kurs: Zement-Pass (VIKA-5).**
- 3 Kurse × 3 Segmente; `BRICK_H = 0.238` → Kurs-Z = k·BRICK_H.

## 5. HMI-Bridge (hmi_bridge.py)

- Übersetzt Web-Kommandos → ROS Motion-Control.
- Subs: `/hmi/cmd` (HOME/STOP/READY), `/hmi/joint_jog`+`/joint_set`, `/hmi/rail_jog`+`/rail_to`, `/hmi/tcp_jog` (kartesisch), `/hmi/goto`+`/goto_yaw` (IK), `/hmi/suck`.
- Aktuiert via `follow_joint_trajectory` (arm_controller, rail_controller) + MoveGroup `/move_action`.
- Quaternionen: `READY_QUAT` (Werkzeug runter) / `PLACE_QUAT` (90°-Yaw, Pads spannen Y).

## 6. Simulation (Gazebo Harmonic)

- Welt `construction_site.sdf`, nativ mit GPU. Spawn-x/y ignoriert (Platzierung im URDF).
- **Eine** dynamische Pick-Row bei `PICK_Y=0.04`, `PALLET_X=-0.6`; Rest statische Deko.
- Masonry-Reihenfolge (lay_course.sh): erst Pick-Row per `set_pose` auf Palette zurück, **dann** statische Wall-Bricks spawnen — sonst überlappen Modelle → Physik explodiert. Bricks 0.375×0.25×0.238 m, 90°-Yaw.

## 7. Sprachsteuerung

- Mikro: Web Speech API (de-DE) → Ollama **Gemma** (`gemma4:12b`, env-konfig.) gibt **nur JSON** `{robot, action}` (HOME/STOP/READY/BUILD/CEMENT/AUTO/SELECT/NONE); Fallback = Keyword-Regex.
- Antwort: **Kokoro TTS** (OpenAI-kompat., Stimme `af_heart`, Englisch) via HTML5-Audio.
- Action → `/hmi/cmd` bzw. `/hmi/mission`.

## 8. Motion Planning

- OMPL, Default **RRTConnect** (RRT* verfügbar). attempts 6, time 2–3 s, vel/acc-scaling 0.7.
- Selbstkollision aus (grobes Primitivmodell überlappt in Normalposen); Umgebungskollision via Planning Scene (Palette, Wall-Bricks, Boden).

---

## Stack starten

Hybrid: **Gazebo + ROS 2 nativ** (GPU, gleicher Namespace), **rosbridge/Perception/HMI in Docker**, DDS auf `ROS_DOMAIN_ID=42` (host).

```bash
# Empfohlen (robust): killt DDS-Ghosts, wartet auf aktive Controller, bis 4× Retry
./restart-clean.sh           # idle
./restart-clean.sh build     # + BUILD-Mission

# Einfach:
./start.sh                   # ROS sourcen → HMI-Container → Gazebo → ros2 launch vika_bringup full_demo.launch.py
```
- HMI `http://localhost:5173` · rosbridge `ws://localhost:9090` · Gazebo nativ.
- **Warum restart-clean?** start.sh verliert manchmal Spawner-Lock-Race (Controller nie *active* → 33 % RTF, nichts bewegt sich) + DDS-Ghost-Nodes (doppelter bt_node). restart-clean macht zuerst `docker restart vika_ros` (purged Prozesse + DDS), dann ein start-docker, wartet auf ≥3 aktive Controller.

```bash
# Mission manuell:
ros2 topic pub --once /hmi/mission std_msgs/msg/String '{data: BUILD}'
```

---

## Schnelle "Warum?"-Antworten

| Frage | Antwort |
|---|---|
| KDL statt TRAC-IK? | nicht-redundanter 6-DOF, kein Redundanz-Nutzen |
| j1=1.55? | exaktes Limit → MoveIt lehnt Start-State ab |
| Top-down ablegen? | seitlich verhakt an Nachbarsteinen |
| DetachableJoint? | echte Saugphysik teuer/instabil |
| robot_b IK auf cement_base? | sonst 7-DOF-redundant, j4 zuckt |
| Nozzle z+0.31? | base erreichbar; lange Düse erreicht Steinoberfläche |
| Respawn vor Wall-Spawn? | Modell-Überlappung → Physik explodiert |
| Eine dynamische Pick-Row? | Rest Deko; zuverlässiger Pick an festem Y |
| Selbstkollision aus? | grobes Primitivmodell überlappt in Normalposen |
