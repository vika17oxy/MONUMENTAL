API Reference
=============

This chapter summarises the ROS 2 packages, the key scripts and the principal
interfaces of the VIKA workspace (``vika_ws/src``).

Packages
--------

.. list-table::
   :header-rows: 1
   :widths: 24 76

   * - Package
     - Responsibility
   * - ``vika_description``
     - URDF and xacro for both robots, the rail base, the end effectors and the
       ``ros2_control`` description, plus meshes, RViz config and xacro unit
       tests.
   * - ``vika_gazebo``
     - The construction-site world, the brick and pallet models, and helper
       scripts (``reset_bricks.sh``, ``lay_course.sh``, ``refill_pallet.sh``).
   * - ``vika_moveit``
     - MoveIt 2 config (SRDF, kinematics, joint limits, controllers) and motion
       scripts (``tcp_jog.py``, ``pick3_lift.py``, ``arm_client.py``,
       ``fold_arms.py``), plus config unit tests.
   * - ``vika_control``
     - ``ros2_control`` controller configuration for both robots.
   * - ``vika_bringup``
     - Top-level launch (``full_demo.launch.py``) and the e2e smoke checks.
   * - ``vika_mission``
     - Mission action definitions (``BuildWall``, ``PickBrick``, ``PlaceBrick``,
       ``ApplyCement``) and a reference ``build_wall.xml`` tree. The live mission
       runs as a small custom Python behaviour-tree engine in
       ``vika_moveit/scripts/bt_node.py``.
   * - ``vika_teleop``
     - Manual teleoperation (joystick and gamepad) config and launch.
   * - ``vika_hmi_bridge``
     - Bridge node exposing HMI commands and state to ROS.
   * - ``vika_mcp``
     - MCP server scaffold exposing world and mission controls to an external
       LLM.

Key scripts (``vika_moveit/scripts``)
-------------------------------------

``tcp_jog.py``
   Console HMI for the required linear TCP jog. Reads ``x+/x-/y+/y-/z+/z-``
   commands, computes inverse kinematics for the offset Cartesian target of the
   selected arm and executes the trajectory, moving the TCP along a straight
   line.

``pick3_lift.py``
   Picks a row of three bricks: lower the suction gripper onto the row, attach
   the ``DetachableJoint`` grasp (one per dynamic row) and lift.

``arm_client.py``
   Reusable client for inverse kinematics (with seed and collision options),
   MoveGroup planning and trajectory-action execution.

``fold_arms.py``
   Drives both arms into the compact folded stow pose used at start-up.

``hmi_bridge.py``
   Translates the ``/hmi/*`` topics the web dashboard publishes into robot
   motion, driving each robot ``arm_controller`` and ``rail_controller``
   trajectory actions and the suction attach and detach topics.

``bt_node.py``
   The live mission behaviour-tree engine (Sequence, Fallback, Condition,
   Action). Listens on ``/hmi/mission`` (``START`` and ``STOP``), drives the
   robots through the ``/hmi/*`` topics, and publishes the flattened tree on
   ``/bt/state`` for the HMI.

``dino_detector.py``
   The optional Grounding DINO brick detector (see :doc:`ai_modules`).

Principal interfaces
-------------------

Telemetry and planning:

* ``/joint_states``: joint telemetry per robot (published by
  ``joint_state_broadcaster``); drives the HMI digital twin.
* ``/move_action`` and ``/robot_b/move_action``: the MoveIt 2 ``MoveGroup`` action
  used for the Cartesian TCP jog.
* ``<robot>/arm_controller/follow_joint_trajectory``: arm motion.
* ``<robot>/rail_controller/follow_joint_trajectory``: the prismatic rail
  carriage.
* TF chain ``world`` to ``*_arm_tcp``: TCP pose for planning and HMI readout.

HMI command topics (served by ``hmi_bridge.py``):

* ``/hmi/active_robot`` (``String``): select ``robot_a`` or ``robot_b``.
* ``/hmi/cmd`` (``String``): ``HOME`` or ``STOP``.
* ``/hmi/joint_jog`` and ``/hmi/joint_set`` (``Float64MultiArray``): relative and
  absolute joint targets.
* ``/hmi/rail_jog`` and ``/hmi/rail_to`` (``Float64``): relative and absolute
  rail.
* ``/hmi/tcp_jog`` (``Vector3``): Cartesian ``dx, dy, dz`` linear TCP jog.
* ``/hmi/suction`` (``Bool``) and ``/hmi/suck`` (``String``): vacuum gripper.
* ``/suction/r0_0/attach`` and ``/suction/r0_0/detach``: grasp/release the
  dynamic pick row (the row id is ``r``-prefixed because a topic segment may not
  start with a digit).

Mission and perception:

* ``/hmi/mission`` (``String``, ``START`` or ``STOP``): drive the build mission.
* ``/bt/state`` (``String`` JSON): the flattened behaviour tree for the HMI.
* ``/hmi/detect`` (``Empty``): trigger a brick detection.
* ``/detect/result`` (``String`` JSON) and ``/detect/image/compressed``: the
  detector output.

MCP tools (``vika_mcp``, scaffold)
----------------------------------

The server declares ``list_models``, ``spawn_model`` and ``mission_start``. The
call dispatch is being wired to the ``/hmi/*`` and Gazebo interfaces.
