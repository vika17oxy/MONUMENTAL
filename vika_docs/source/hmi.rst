Human-Machine Interface (HMI)
=============================

The HMI is a web application (Vite, React 19, TypeScript, shadcn/ui and
three.js), which goes well beyond the console-application minimum of the
assignment. It talks to ROS 2 over ``rosbridge_server`` (WebSocket port 9090) via
``roslibjs``, and a ``ros_gz_bridge`` connects the Gazebo and ROS sides.

The HMI opens at ``http://localhost:5173``.

Linear TCP jog (required feature)
---------------------------------

The central required feature is moving a robot TCP linearly using inverse
kinematics. VIKA provides this in two forms.

The console application (``vika_moveit/scripts/tcp_jog.py``) is the assignment
minimum. It reads ``x+``, ``x-``, ``y+``, ``y-``, ``z+`` and ``z-`` commands and
moves the selected arm TCP by a fixed step. Each command computes IK for the new
Cartesian target and executes the trajectory, so the tool travels along a
straight Cartesian line.

The web panel (``TcpJogPanel.tsx``) offers plus and minus X, Y and Z buttons with
a step-size control. It performs the same IK-based Cartesian jog from the
browser, with a live TCP pose readout from ``/tf``.

Both rely on MoveIt 2 inverse kinematics, which satisfies the requirement that
the HMI move a robot at the TCP linearly.

Panels
------

.. list-table::
   :header-rows: 1
   :widths: 26 74

   * - Panel
     - Function
   * - 3D digital twin
     - A three.js scene rendering both robot URDFs, animated live from
       ``/joint_states`` as a real-time digital twin of the Gazebo cell.
   * - TCP jog
     - Linear Cartesian jog of the selected arm via inverse kinematics.
   * - Joint sliders
     - Direct per-joint commanding for setup and debugging.
   * - Rail panel
     - Moves each robot prismatic carriage along its rail.
   * - Mission panel
     - Start, pause and abort the cooperative build mission and watch its state.
   * - Teleop panel
     - Manual base and jog control via virtual joysticks (gamepad supported).
   * - Sensor panel
     - Live wrist-camera view and other telemetry.
   * - Wrist view
     - Dedicated camera feed from the placing arm. The planned brick-detection
       overlay attaches here (see :doc:`ai_modules`).
   * - Wall-draw panel
     - Draw a wall outline on a grid (touch-friendly). The line is sampled into
       brick positions and handed to the build mission.
   * - Prompt card and voice
     - Natural-language and voice command input. The local-LLM parsing and spoken
       replies are planned future work (see :doc:`ai_modules`).
   * - Mission tree view
     - Live behaviour-tree state from ``/bt/state``, drawn as a tree with
       per-node status colour.
   * - Robot selector and tabs
     - Switch the active robot (A, B or both) for the control panels.

Voice interface (planned)
------------------------

A microphone prompt card is in place for spoken commands. The intended pipeline
parses them with a local Gemma model (served by Ollama) into ``/hmi/*`` commands
and speaks replies back via Kokoro text-to-speech. This AI layer is documented as
future work in :doc:`ai_modules`. The typed prompt input is the convenience layer
available today.

Bridge architecture
-------------------

::

   Browser (React + three.js)
     |  WebSocket :9090 (roslibjs)
     v
   rosbridge_server  ->  ROS 2 Jazzy nodes (MoveIt, ros2_control, mission)
                          ^
                          |  ros_gz_bridge
                          v
                       Gazebo Harmonic
