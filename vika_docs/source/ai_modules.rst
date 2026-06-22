AI Modules (Bonus, future work)
===============================

The assignment lists AI integration only as an optional nice-to-have. VIKA goes
beyond the core deliverable by laying the groundwork for three AI features: an
open-vocabulary brick detector, a local-LLM voice control layer, and an MCP
world-control server. These are planned future work. The building blocks and the
wiring exist, but they are not part of the core, verified demo path. The base
simulation, IK control and HMI run fully without any of them.

This chapter documents the foundation already in place and the direction each
module is heading.

Open-vocabulary brick detection (Grounding DINO)
------------------------------------------------

Status: groundwork laid, optional add-on.

The brick detector (``vika_moveit/scripts/dino_detector.py``) is built around the
open-vocabulary, zero-shot model Grounding DINO
(``IDEA-Research/grounding-dino-tiny``) via Hugging Face ``transformers``. The
model is prompt-driven, so no custom dataset or training is needed; it is queried
with the text prompt ``"a brick."``.

The intended flow runs on demand rather than continuously:

#. The HMI or the mission publishes ``/hmi/detect`` (``std_msgs/Empty``).
#. The node grabs the latest wrist-camera frame.
#. Grounding DINO returns bounding boxes. Weak, oversized and tiny boxes are
   filtered using a confidence threshold, area limits and NMS.
#. Each box centre is back-projected through the camera intrinsics and the live
   wrist-camera TF onto the brick-top plane, giving a world ``(x, y, z)`` pose.

Outputs:

* ``/detect/image/compressed``, the camera frame with boxes drawn, for the HMI
  view.
* ``/detect/result``, a ``std_msgs/String`` JSON message with the detections
  (``box``, ``score`` and ``world`` pose).

The node degrades gracefully: if ``torch`` or ``transformers`` are missing it
stays alive and reports "offline", so the HMI does not crash.

Voice and natural-language control (local LLM)
----------------------------------------------

Status: groundwork laid, optional add-on.

The HMI prompt card is designed to turn spoken or typed commands into robot
actions:

#. Speech or text is sent to a local Gemma model served by Ollama (default
   ``gemma4:12b`` at ``http://localhost:11434``), which returns a structured
   intent as JSON. A keyword parser is the fallback when Ollama is unreachable.
#. The intent is mapped onto the existing ``/hmi/*`` command topics (select
   robot, jog, home, start mission, detect, and so on).
#. VIKA speaks the result back through Kokoro text-to-speech
   (``kokoro-fastapi``, OpenAI-compatible endpoint, voice ``af_heart``, English).

The design keeps the whole AI control loop local, with no cloud dependency, so
that once completed an operator could command the cell hands-free.

MCP server (scaffold)
--------------------

Status: scaffold.

The ``vika_mcp`` package provides a Model Context Protocol (MCP) server
(``server.py``) that exposes world and mission controls (for example
``list_models``, ``spawn_model`` and ``mission_start``), so that an external MCP
client such as Claude can drive the cell. The server is currently a scaffold: the
tool list is defined, and the dispatch is being wired to the same ``/hmi/*`` and
Gazebo interfaces the rest of the system already uses.

Why these modules matter
-----------------------

Once finished, these modules would demonstrate two uses of AI in an industrial
cell. The first is supervisory control: a local LLM lets an operator command and
query the cell in natural language, without touching code. The second is
perception: open-vocabulary detection locates bricks in the camera image and
returns world poses, which is the basis for a visual placement check.

For now they are documented as the project AI roadmap, with the camera, the
detector node, the LLM and TTS wiring and the MCP scaffold already in the
repository as the starting point.
