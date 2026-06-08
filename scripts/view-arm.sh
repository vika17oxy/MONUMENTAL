#!/usr/bin/env bash
# Single-entry launcher for stepwise arm viewer.
# Kills any prior RViz/JSP/robot_state_publisher instances,
# rebuilds vika_description, then launches the current view_base.launch.py.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Killing prior RViz / JSP / robot_state_publisher (host + container)"
KILL_PATTERNS='rviz2|joint_state_publisher|joint_state_publisher_gui|robot_state_publisher|ros2 launch|view_base.launch'
# Host (WSL native)
pkill -9 -f "$KILL_PATTERNS" 2>/dev/null || true
# Inside docker container — try SIGTERM first, then SIGKILL
if docker ps --filter name=vika_ros --format '{{.Names}}' | grep -q vika_ros; then
  docker exec vika_ros bash -c "pkill    -f \"$KILL_PATTERNS\" 2>/dev/null; sleep 0.5; pkill -9 -f \"$KILL_PATTERNS\" 2>/dev/null" 2>/dev/null || true
fi
sleep 0.5

echo "==> Ensuring vika_ros container is up"
docker compose -f "$ROOT/docker/docker-compose.yml" up -d ros >/dev/null

echo "==> Rebuilding vika_description"
docker exec vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  cd /ws && colcon build --packages-select vika_description 2>&1 | tail -3
'

echo "==> Launching RViz + joint_state_publisher_gui"
DOCKER_FLAGS="-i"
[ -t 0 ] && DOCKER_FLAGS="-it"
exec docker exec $DOCKER_FLAGS vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  source /ws/install/setup.bash
  ros2 launch vika_description view_base.launch.py
'
