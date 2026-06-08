#!/usr/bin/env bash
# Launch MoveIt + RViz with MotionPlanning panel (gizmo ball for IK target).
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

bash "$SCRIPT_DIR/stop.sh"

echo "==> Starting vika_ros container"
docker compose -f "$ROOT/docker/docker-compose.yml" up -d ros >/dev/null

echo "==> Building vika_description + vika_moveit"
docker exec vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  cd /ws && colcon build --packages-select vika_description vika_moveit 2>&1 | tail -5
'

echo "==> Launching MoveIt + RViz"
DOCKER_FLAGS="-i"
[ -t 0 ] && DOCKER_FLAGS="-it"
exec docker exec $DOCKER_FLAGS vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  source /ws/install/setup.bash
  ros2 launch vika_moveit vika_moveit.launch.py
'
