Simulation
==========

Simulator and middleware
-----------------------

* Simulator: Gazebo Harmonic.
* Middleware: ROS 2 Jazzy with ``ros2_control`` and MoveIt 2.
* Runtime: everything runs inside the ``vika_ros`` Docker container, and the HMI
  runs in a separate ``vika_hmi`` container. The Gazebo server runs headless
  (``gz sim -r -s``), and an optional GUI client attaches for visualisation.

Construction-site world
-----------------------

The world (``vika_gazebo/worlds/construction_site.sdf``) holds the masonry cell:

* A ground plane and a pallet as the brick source.
* A flat 3x3 layer of three brick rows on the pallet. Only ``row_0_0`` is a
  *dynamic* pick row that the suction gripper grabs and that respawns; the other
  two rows (``row_1_0``, ``row_2_0``) are static decoration. The dynamic row is
  modelled separately from the static wall bricks for performance.
* The wall zone between the two robot rails, where placed bricks
  (``wall_brick.sdf``) and the cement strip (``cement_strip.sdf``) accumulate.

Both robots are spawned into this one world at once, on their parallel rails,
which satisfies the requirement that both robots are visible and moving in a
single simulation. The scene is intentionally lean; extra industrial dressing
such as a fence is a possible future addition and is not part of the current
world.

Control stack
-------------

``ros2_control`` is provided in simulation by ``gz_ros2_control`` (configured in
``vika.ros2_control.xacro``). Per robot the controllers are:

* ``joint_state_broadcaster``, which publishes ``/joint_states``.
* ``arm_controller``, a ``JointTrajectoryController`` for the arm joints.
* ``rail_controller``, a ``JointTrajectoryController`` for the prismatic rail
  carriage.

The vacuum gripper is not a ``ros2_control`` controller. Grasping is done with a
Gazebo ``DetachableJoint`` plugin toggled over the per-row ``/suction/r0_0/attach``
and ``/suction/r0_0/detach`` topics (the row id is ``r``-prefixed because a topic
segment may not start with a digit).

MoveIt 2 ``move_group`` runs against these live controllers. Inverse kinematics
use the KDL solver. The ``MoveGroup`` action and the TF chain
(``world`` to ``*_arm_tcp``) are available for planning and for the HMI linear
TCP jog.

Sensors and actuators
--------------------

The cell integrates several simulated sensors and actuators:

* A wrist camera on the placing arm, the image source for the planned brick
  detector (see :doc:`ai_modules`).
* Vacuum suction (a single ``DetachableJoint`` plugin on the dynamic row) as the
  grasp actuator.
* Cement extrusion as the bonding actuator.
* Joint state and TF telemetry for the digital twin.

Numerical stability
-------------------

Several deliberate choices keep the simulation stable and reproducible:

* Primitive collision instead of trimesh. This removed thousands of ODE trimesh
  overflows and the associated crashes.
* World-anchored rails, which keep each robot's base fixed and well-conditioned.
* A folded stow pose at spawn, which avoids start-up droop or self-contact.

Verification
-----------

A test suite (``scripts/run_tests.sh``) backs the simulation:

* 18 unit tests. The xacro for both robots parses to valid URDF with the expected
  joints, links and limits, and the SRDF, kinematics and controller configs are
  well-formed and mutually consistent. These are pure parsing tests: fast,
  deterministic and with no running sim needed.
* 11 end-to-end smoke checks against a running sim. Both robots publish
  ``joint_states`` (arm joints and rail), values are finite, arms stay within
  limits (no collapse), MoveIt IK is available, and TF resolves ``world`` to
  ``*_arm_tcp``.
