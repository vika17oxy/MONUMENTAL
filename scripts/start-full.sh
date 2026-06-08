#!/usr/bin/env bash
# Full integration: Gazebo + spawn + MoveIt + RViz, ALL inside docker.
# Container has GPU passthrough via /dev/dxg + /usr/lib/wsl.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> [1/4] Cleanup"
bash "$SCRIPT_DIR/stop.sh" >/dev/null 2>&1 || true
pkill -9 -f 'gz sim' 2>/dev/null || true
docker exec vika_ros bash -c 'pkill -9 -f "gz sim" 2>/dev/null' 2>/dev/null || true

echo "==> [2/4] Recreating vika_ros container with GPU passthrough"
docker compose -f "$ROOT/docker/docker-compose.yml" down 2>/dev/null || true
docker compose -f "$ROOT/docker/docker-compose.yml" up -d ros >/dev/null
sleep 2

echo "==> [3/4] Building workspace"
docker exec vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  cd /ws && colcon build --packages-select vika_description vika_moveit vika_gazebo 2>&1 | tail -5
'

echo "==> [4/4] Launching Gazebo + ROS stack inside container"
DOCKER_FLAGS="-i"
[ -t 0 ] && DOCKER_FLAGS="-it"
exec docker exec $DOCKER_FLAGS vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  source /ws/install/setup.bash
  export ROS_DOMAIN_ID=42 GZ_PARTITION=vika GZ_IP=127.0.0.1
  export GZ_SIM_RESOURCE_PATH=/ws/src:/ws/install/vika_description/share:/ws/install/vika_gazebo/share
  export GZ_SIM_SYSTEM_PLUGIN_PATH=/opt/ros/jazzy/lib

  # Start Gazebo in background
  gz sim -r -v 3 /ws/install/vika_gazebo/share/vika_gazebo/worlds/construction_site.sdf > /tmp/gz.log 2>&1 &
  GZ_PID=$!

  echo "Waiting 8s for Gazebo to spin up..."
  sleep 8

  # Now launch the ROS stack (RSP + spawn + MoveIt + RViz)
  ros2 launch vika_moveit vika_full.launch.py

  kill $GZ_PID 2>/dev/null || true
'
