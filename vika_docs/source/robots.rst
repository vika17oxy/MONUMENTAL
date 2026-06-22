Robot Construction
==================

Both robots are modelled in xacro (parameterised URDF) under
``vika_description/urdf``. Each robot is a purely serial kinematic chain mounted
on a world-anchored linear rail. The two arms are self-designed: their
dimensions are sized to a realistic industrial class (link lengths, masses, joint
limits and torques), but the geometry is original and is not a copy of any
commercial robot.

Shared base: linear rail
------------------------

Both robots use the same base concept (``base_rail.xacro``):

* A world-anchored rail, 12.5 m long, with the robot fixed at plus or minus 2 m
  via the ``base_x`` and ``base_yaw`` xacro arguments. The rail is world-fixed,
  so the spawn pose does not move it.
* A prismatic carriage that slides along the rail, driven by the
  ``rail_controller``. This lets each arm traverse the full wall length.

The rail base replaced an earlier tracked mobile platform. It gives the same
"reach the whole wall" capability while keeping the simulation numerically stable
and easy to control.

robot_a (VIKA): 6-DOF articulated arm (Elias)
---------------------------------------------

A classic anthropomorphic RRR-RRR arm (``arm_6dof.xacro``): a shoulder, an elbow
and a 3-DOF spherical wrist. Six degrees of freedom give full position and
orientation control of the tool, which is what pick-and-place onto an angled wall
course needs.

.. list-table:: robot_a joint limits and torques
   :header-rows: 1
   :widths: 14 40 22 24

   * - Joint
     - Function
     - Range
     - Torque
   * - J1
     - base rotation
     - plus/minus 185 deg
     - 80 Nm
   * - J2
     - shoulder
     - -155 to +35 deg
     - 80 Nm
   * - J3
     - elbow
     - -130 to +154 deg
     - 60 Nm
   * - J4
     - wrist roll
     - plus/minus 350 deg
     - 20 Nm
   * - J5
     - wrist pitch
     - plus/minus 130 deg
     - 20 Nm
   * - J6
     - tool rotation
     - plus/minus 350 deg
     - 15 Nm

* Reach: about 1.4 m. Payload: about 7 kg (a brick row plus the gripper, with
  reserve).
* Level of detail: the visual model uses Fusion-exported STL meshes, while the
  collision model uses primitive shapes (boxes and cylinders) for stable, fast
  physics.

robot_b (VIKA 5): 5-DOF arm (Viktoriia)
---------------------------------------

A standalone 5-DOF serial arm with its own geometry. It deliberately has one axis
fewer: for tracing a cement line, rotation about the nozzle's long axis is
functionless because the nozzle is rotationally symmetric, so that wrist axis is
dropped (the chain is an RRR shoulder and elbow plus a 2-DOF wrist).

.. list-table:: robot_b joint limits and torques
   :header-rows: 1
   :widths: 14 40 22 24

   * - Joint
     - Function
     - Range
     - Torque
   * - J1
     - base rotation
     - plus/minus 185 deg
     - 80 Nm
   * - J2
     - shoulder
     - -150 to +40 deg
     - 80 Nm
   * - J3
     - elbow
     - -125 to +150 deg
     - 55 Nm
   * - J4
     - wrist pitch
     - plus/minus 130 deg
     - 20 Nm
   * - J5
     - nozzle approach angle
     - plus/minus 180 deg
     - 15 Nm

* Reach: about 1.5 m, slightly longer so it can reach over the wall top edge.
* Payload: about 5 kg (nozzle plus cement reserve).
* Five degrees of freedom are sufficient because the cement bead only requires
  positioning the nozzle tip and its approach angle along the wall edge.

End effectors
-------------

Each tool is its own xacro and is attached at the arm flange (``*_arm_tool0``).

Vacuum suction gripper (``tool_gripper.xacro``, robot_a):

* A horizontal bar carrying three suction pads spaced one brick apart, so the
  gripper picks a full row of three bricks in a single motion.
* Grasping is simulated with three Gazebo ``DetachableJoint`` plugins. Publishing
  on the attach topic fixes the three pick bricks to the pads, and detaching
  releases them. ``reset_bricks.sh`` detaches and re-drops the bricks onto the
  pallet at startup.

Cement nozzle (``tool_cement.xacro``, robot_b):

* A nozzle head that extrudes a cement bead as the arm traces the wall edge.
* Placed bricks are bonded to the wall after a bead is laid.

Realistic design
----------------

* Masses and inertia are set per link, and joint limits and torques are sized to
  a realistic industrial arm class.
* Self-collision is disabled in the SRDF because the collision model is
  intentionally coarse (primitive shapes). This avoids false
  ``START_STATE_IN_COLLISION`` reports while keeping physics stable.
* Both arms spawn in a compact folded stow pose, so they never droop or collide
  at start-up.
