Industrial Use Case
===================

Scenario: Modular Masonry Automation Cell
-----------------------------------------

Two autonomous robots build a brick wall in a construction cell. Each robot sits
on its own linear rail so that it can traverse the full length of the wall. The
two rails run parallel to each other on opposite sides of the wall line, and the
robots face each other across it.

* robot_a (VIKA, Elias) is a 6-DOF articulated arm with a vacuum suction
  gripper. Its three suction pads pick a row of three bricks at once from the
  pallet and place them on the wall.
* robot_b (VIKA 5, Viktoriia) is a 5-DOF arm with a cement nozzle. It traces the
  current top edge of the wall as a Cartesian path and extrudes a cement bead
  onto which the next course is bonded.

Cooperative build cycle
-----------------------

The two robots share one process, which is the core requirement of the
assignment, by alternating between bonding and placing for every course of the
wall:

#. Reset and supply. A pallet of bricks sits at the edge of the cell, and the
   dynamic pick row (three fused bricks) is dropped onto the pallet.
#. Bond (robot_b). VIKA 5 traverses its rail and traces the current wall top edge
   with the cement nozzle, laying a continuous cement bead.
#. Pick (robot_a). VIKA lowers its suction gripper onto a brick row, attaches the
   three bricks and lifts them.
#. Place (robot_a). VIKA carries the row to the wall and sets it on the fresh
   cement bead, then releases the vacuum.
#. Bond next course (robot_b). The nozzle applies cement on top of the new
   course.
#. Loop. Steps 3 to 5 repeat course by course until the wall is complete.

Both robots run on rails along the same wall and depend on each other's output:
there is no placing without a cement bead, and no next bead without a placed
course. The interaction is therefore a genuine shared process rather than two
independent tasks.

Industrial context and economic rationale
------------------------------------------

The scenario has a clear industrial and economic justification:

* Labour shortage. Skilled masons are increasingly scarce, and automation keeps
  output up without proportionally scaling the crew.
* Throughput and consistency. A robotic cell lays courses at a constant rate with
  repeatable joint geometry and bead thickness.
* Safety. Heavy, repetitive lifting is moved off the human worker. In a real
  deployment the cell would be fenced and interlocked.
* Driven by a digital model. The wall geometry comes from a CAD or HMI model, so
  the same cell can build any wall layout without re-tooling, mirroring the
  CAD-to-build workflow of the Hadrian X.

Real-world references
---------------------

* `FBR Hadrian X <https://www.fbr.com.au>`_, an automated block-laying boom.
* Construction Robotics SAM100, a semi-automated mason and mortar applicator.
