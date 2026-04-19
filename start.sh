#!/usr/bin/env bash
# BrickBot — single-entry launch script (Angabe Section 3, line 88)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> BrickBot launcher"
echo "    Working dir: $SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Install Docker Desktop or Docker Engine in WSL2." >&2
  exit 1
fi

echo "==> Starting ROS2 Jazzy container (host network)"
docker compose -f docker/docker-compose.yml up -d ros

echo "==> Building colcon workspace (first run may take a few minutes)"
docker compose -f docker/docker-compose.yml exec -T ros bash -lc \
  "cd /ws && colcon build --symlink-install --event-handlers console_cohesion+"

echo "==> Launching Gazebo + ROS2 stack"
docker compose -f docker/docker-compose.yml exec -T ros bash -lc \
  "source /opt/ros/jazzy/setup.bash && source /ws/install/setup.bash && \
   ros2 launch brickbot_bringup full_demo.launch.py" &
ROS_PID=$!

echo "==> Starting HMI (Vite dev server)"
if [ -d brickbot-hmi/node_modules ]; then
  ( cd brickbot-hmi && pnpm dev ) &
  HMI_PID=$!
else
  echo "    HMI deps not installed yet. Run: cd brickbot-hmi && pnpm install"
fi

echo ""
echo "==> BrickBot running:"
echo "    HMI:       http://localhost:5173"
echo "    rosbridge: ws://localhost:9090"
echo "    Gazebo:    native window (from container)"
echo ""
echo "Press Ctrl+C to stop."

trap 'echo "==> Shutting down..."; kill $ROS_PID ${HMI_PID:-} 2>/dev/null || true; docker compose -f docker/docker-compose.yml down' INT TERM
wait
