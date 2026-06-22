Launch Guide
============

Start everything
----------------

A single script brings up the entire cell:

.. code-block:: bash

   ./start-docker.sh

This script does the following:

#. Starts the ``vika_ros`` and ``vika_hmi`` containers.
#. Launches the Gazebo Harmonic server headless, plus an optional GUI client.
#. Runs ``vika_bringup full_demo.launch.py``, which starts the ``ros_gz_bridge``,
   spawns both robots and starts all controllers.
#. Starts ``rosbridge_server`` on ``ws://localhost:9090`` for the HMI.
#. Resets the pick bricks onto the pallet (``reset_bricks.sh``) and folds both
   arms into their stow pose (``fold_arms.py``).

Endpoints once it is up:

* HMI at ``http://localhost:5173``.
* rosbridge at ``ws://localhost:9090``.
* Gazebo GUI in a native window (optional, cosmetic).

Stop the simulation processes (the containers stay up) with:

.. code-block:: bash

   ./start-docker.sh stop

Demo workflow
------------

.. code-block:: bash

   ./start-docker.sh              # bring up gz, both robots, controllers and HMI
   ./scripts/run_tests.sh         # 18 unit and 11 e2e checks; proves the sim is healthy

Then, from the HMI at ``http://localhost:5173``:

#. Watch the 3D digital twin mirror both robots live.
#. Open the TCP jog panel, pick a robot, and press the X, Y or Z buttons. The
   tool moves linearly via inverse kinematics.
#. Use the rail panel to traverse a robot along its rail.
#. Start the cooperative build mission from the mission panel and watch the pick,
   place and cement cycle build the wall.
#. Try the wall-draw panel: sketch a wall and have the robots build it.

Console TCP jog (assignment minimum)
------------------------------------

The required linear-TCP-jog feature is also available as a console application:

.. code-block:: bash

   # once move_group is up:
   ros2 launch vika_moveit robot_a_move_group.launch.py
   python3 /ws/src/vika_moveit/scripts/tcp_jog.py
   #   commands: x+  x-  y+  y-  z+  z-

Running the tests
----------------

.. code-block:: bash

   ./scripts/run_tests.sh unit    # 18 unit tests (xacro, SRDF, config); no sim needed
   ./scripts/run_tests.sh e2e     # 11 e2e smoke checks against a running sim
   ./scripts/run_tests.sh         # both

Rebuilding this PDF
------------------

.. code-block:: bash

   cd vika_docs
   sphinx-build -b rinoh source build/rinoh    # build/rinoh/VIKA.pdf

A LaTeX backend is also configured: ``make latexpdf`` produces the same PDF if a
full TeX distribution is installed.

Known operational notes
-----------------------

* ``GZ_PARTITION=vika`` must be set for any ``gz`` CLI call from a fresh shell in
  the container.
* On NVIDIA and Wayland the Gazebo GUI is forced onto software GL to avoid a GLX
  segfault. The server, controllers and HMI do not depend on the GUI.
* Nodes launched with ``docker exec`` are not children of the start script, so
  ``./start-docker.sh stop`` explicitly kills them to avoid stale duplicates.
