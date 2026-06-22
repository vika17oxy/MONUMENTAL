Installation
============

VIKA runs entirely in Docker, so the only host requirements are Docker and a copy
of the repository. All ROS 2 Jazzy, Gazebo Harmonic, MoveIt 2 and HMI
dependencies are baked into the two container images.

Prerequisites
-------------

* Docker with the Compose plugin (``docker compose``).
* For hardware-accelerated Gazebo rendering, the NVIDIA Container Toolkit (the
  compose file requests the ``nvidia`` runtime). Software rendering works as a
  fallback.
* An X server on the host for the optional Gazebo GUI (run ``xhost +`` once).
* Git, to clone the repository.

The HMI image bundles Node and the web dependencies, so no host Node install is
required to run the dashboard.

Get the code
------------

.. code-block:: bash

   git clone https://github.com/eliasbitsch/MONUMENTAL.git
   cd MONUMENTAL

Build the images
----------------

Two images are built from ``docker/``:

* ``vika/ros:jazzy``: ROS 2 Jazzy, Gazebo Harmonic, MoveIt 2 and the colcon
  workspace.
* ``vika/hmi:dev``: the Vite and React web HMI.

.. code-block:: bash

   docker compose -f docker/docker-compose.yml build

.. note::

   The brick-detection add-on (Grounding DINO) is optional. Bake it in
   permanently with::

      WITH_PERCEPTION=1 docker compose -f docker/docker-compose.yml build ros

Third-party dependencies
------------------------

Everything is pinned in the images and package manifests. The principal external
components are:

* ROS 2 Jazzy, ``ros2_control`` and ``gz_ros2_control``, and MoveIt 2.
* Gazebo Harmonic and ``ros_gz_bridge``.
* ``rosbridge_suite`` (``rosbridge_server``) for the web HMI WebSocket.
* Vite, React 19, TypeScript, shadcn/ui, three.js and ``roslibjs`` for the HMI.
* A small custom Python behaviour-tree engine for the mission logic.
* Grounding DINO via Hugging Face ``transformers`` and ``torch`` (optional) for
  brick detection.
* Ollama (a local Gemma model) for voice and NL command parsing, and Kokoro
  (``kokoro-fastapi``) for text-to-speech. Both are optional.
* The MCP Python SDK for the world-control server scaffold.

Documentation tooling
---------------------

To rebuild this document, install the doc requirements and a PDF backend:

.. code-block:: bash

   pip install -r vika_docs/requirements.txt
   pip install rinohtype          # pure-Python PDF backend, no LaTeX needed

See :doc:`launch` for how to render the PDF and run the simulation.
