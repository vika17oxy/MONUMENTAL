#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VIKA — clean stop + restart of the whole sim stack.
#
# Why this exists: launching the stack with ./start-docker.sh alone occasionally
# (a) loses the controller_manager spawner lock race -> controllers never go
# active -> "nothing moves / 33% RTF", and (b) leaves DDS "ghost" nodes in the
# discovery graph (network_mode: host) so `ros2 node list` shows 2 bt_nodes.
#
# The fix encapsulated here: do a FULL `docker restart vika_ros` FIRST every time
# (that kills every process in the container AND purges its DDS state -> no
# ghosts, no duplicate bt_node), THEN run start-docker once, THEN wait for the
# controllers. If the spawn race still bit, retry the whole thing (each retry is
# a fresh container, so nothing accumulates). End result: exactly ONE bt_node and
# active controllers, every time.
#
# Usage:  ./restart-clean.sh            # clean restart, leaves the stack idle
#         ./restart-clean.sh build      # ... then start a BUILD mission
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SRC='source /opt/ros/jazzy/setup.bash && source /ws/install/setup.bash'
MAX_ATTEMPTS=4

in_container() { docker exec vika_ros bash -lc "$SRC && $*" 2>/dev/null; }

active_count() {
  in_container "timeout 6 ros2 control list_controllers -c /robot_a/controller_manager 2>/dev/null | grep -c active" | tr -cd '0-9'
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "==> [attempt $attempt/$MAX_ATTEMPTS] full container restart (purges processes + DDS)"
  docker restart vika_ros >/dev/null 2>&1
  echo "    waiting for container..."
  until docker exec vika_ros true 2>/dev/null; do sleep 1; done
  sleep 3

  echo "==> launching stack (start-docker.sh)"
  ./start-docker.sh >/tmp/vika-restart.log 2>&1 || true   # exit code is unreliable; we judge by controllers

  echo "==> waiting for robot_a controllers to go active..."
  ok=0
  for i in $(seq 1 25); do
    n=$(active_count); n=${n:-0}
    if [ "$n" -ge 3 ]; then ok=1; break; fi
    sleep 2
  done

  if [ "$ok" = "1" ]; then echo "==> controllers ACTIVE"; break; fi
  echo "==> controllers did NOT come up (spawn race) — retrying with a fresh restart"
done

echo ""
echo "================ VIKA stack status ================"
in_container "
  echo \"  robot_a controllers active : \$(timeout 6 ros2 control list_controllers -c /robot_a/controller_manager 2>/dev/null | grep -c active)\"
  echo \"  robot_b controllers active : \$(timeout 6 ros2 control list_controllers -c /robot_b/controller_manager 2>/dev/null | grep -c active)\"
  echo \"  gz servers (clock pubs)    : \$(timeout 5 ros2 topic info /clock 2>/dev/null | grep -m1 -oE 'Publisher count: [0-9]+' | grep -oE '[0-9]+')\"
  echo \"  bt_node ROS nodes          : \$(timeout 6 ros2 node list 2>/dev/null | grep -c bt_node)\"
  echo \"  /hmi/mission subscribers   : \$(timeout 5 ros2 topic info /hmi/mission 2>/dev/null | grep -oE 'Subscription count: [0-9]+' | grep -oE '[0-9]+')\"
"
echo "==================================================="

if [ "${1:-}" = "build" ]; then
  echo "==> starting BUILD mission"
  in_container "ros2 topic pub --once /hmi/mission std_msgs/msg/String '{data: BUILD}' >/dev/null 2>&1"
  echo "    BUILD published."
else
  echo "==> idle. Build with:  ./restart-clean.sh build   (or publish /hmi/mission BUILD)"
fi
