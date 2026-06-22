Introduction
============

VIKA (Virtual Industrial Kinematic Arm) is a simulated modular masonry
automation cell developed for the FHTW course MRE2 Robotermodellierung (SS2026).
Two self-designed, cooperating robots build a brick wall autonomously inside a
Gazebo construction site, and the whole cell is operated from a browser-based
Human-Machine Interface (HMI).

Motivation
----------

The construction industry faces a persistent shortage of skilled masons, while
bricklaying remains physically demanding, repetitive and injury-prone. Automated
masonry is therefore an active field of industrial development. VIKA is inspired
by two real products:

* FBR Hadrian X, a truck-mounted boom that lays blocks from a CAD model.
* Construction Robotics SAM100, a semi-automated mason that places bricks and
  applies mortar alongside a human crew.

VIKA reproduces the core idea of these systems, a coordinated pick, place and
bond cycle driven from a digital model of the wall, at simulation scale and with
two cooperating arms instead of one.

Project goals
-------------

The project is built around the assignment requirements and adds several of the
optional features:

#. Two self-designed serial kinematics, one per team member, with self-designed
   end effectors.
#. A cooperative industrial use case with genuine interaction between the two
   robots.
#. A simulation in which both robots are visible and moving, plus an HMI that
   moves a tool centre point (TCP) linearly using inverse kinematics.
#. A single start script and this PDF documentation.
#. As a bonus, a web GUI, plus the groundwork for an AI layer (local-LLM voice
   control and an open-vocabulary brick detector) documented as future work.

Team and roles
--------------

.. list-table::
   :header-rows: 1
   :widths: 22 30 48

   * - Author
     - Robot
     - Role
   * - Elias Bitsch
     - VIKA, a 6-DOF articulated arm with a vacuum suction gripper
     - Pick and place. Picks a row of bricks from the pallet and sets them on the
       wall (6-DOF inverse kinematics).
   * - Viktoriia Ovdiienko
     - VIKA 5, a 5-DOF arm with a cement nozzle
     - Line application. Traces the wall top edge as a Cartesian path and extrudes
       a cement bead.

The two kinematics are deliberately different (6 versus 5 degrees of freedom, and
fundamentally different end effectors), so that each team member contributes one
distinct, self-designed robot, as required by the assignment.

Document structure
------------------

This documentation follows the chapters required by the assignment: the use
case, the robot construction, the simulation, the HMI and the AI modules,
followed by installation and launch instructions and an API reference.
