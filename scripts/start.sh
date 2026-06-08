#!/usr/bin/env bash
# Start: launch RViz + JSP + watcher.
# Watcher reloads robot_state_publisher whenever the URDF .xacro file changes.
# Edit the xacro on disk, save, RViz updates within ~1s.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
URDF_REL="vika_ws/src/vika_description/urdf/base_only.urdf.xacro"

# 1. Clean state first
bash "$SCRIPT_DIR/stop.sh"

# 2. Ensure container up
echo "==> Starting vika_ros container"
docker compose -f "$ROOT/docker/docker-compose.yml" up -d ros >/dev/null

# 3. Initial colcon build (only needed if launch files changed)
docker exec vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  cd /ws && colcon build --packages-select vika_description 2>&1 | tail -3
'

# 4. Launch RViz + JSP + RSP (in background), then watcher
echo "==> Launching RViz + joint_state_publisher_gui (background)"
docker exec -d vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  source /ws/install/setup.bash
  ros2 launch vika_description view_base.launch.py > /tmp/launch.log 2>&1
'

# 5. Wait for RSP to be alive, then start watcher
echo "==> Waiting for robot_state_publisher to come up"
for _ in {1..15}; do
  if docker exec vika_ros bash -lc 'pgrep -f robot_state_publisher >/dev/null'; then
    echo "    RSP is up."
    break
  fi
  sleep 0.5
done

echo "==> Starting URDF watcher (Ctrl-C to stop watching; RViz keeps running)"
echo "    Watching: $URDF_REL"
echo "    Edit the file in your editor, save → RViz reloads ~1s later."
echo ""

DOCKER_FLAGS="-i"
[ -t 0 ] && DOCKER_FLAGS="-it"
exec docker exec $DOCKER_FLAGS vika_ros bash -lc '
  source /opt/ros/jazzy/setup.bash
  source /ws/install/setup.bash
  URDF_SRC=/ws/src/vika_description/urdf/base_only.urdf.xacro
  LAST_MTIME=""
  while true; do
    MTIME=$(stat -c %Y "$URDF_SRC" 2>/dev/null || echo "")
    if [ -n "$MTIME" ] && [ "$MTIME" != "$LAST_MTIME" ]; then
      if [ -n "$LAST_MTIME" ]; then
        echo "==> URDF changed → reloading robot_state_publisher"
        if URDF=$(xacro "$URDF_SRC" 2>&1); then
          pkill -9 -f "ros2 run robot_state_publisher" 2>/dev/null || true
          pkill -9 -x robot_state_publisher           2>/dev/null || true
          sleep 0.3
          ros2 run robot_state_publisher robot_state_publisher \
               --ros-args -p robot_description:="$URDF" \
               > /tmp/rsp.log 2>&1 &
          echo "    reloaded ($(date +%H:%M:%S))"
        else
          echo "    xacro parse error:"
          echo "$URDF" | head -10 | sed "s/^/      /"
        fi
      fi
      LAST_MTIME=$MTIME
    fi
    sleep 1
  done
'
