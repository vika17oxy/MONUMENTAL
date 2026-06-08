#!/usr/bin/env bash
# Kill everything vika-related: ROS nodes, Gazebo, RViz, docker containers.
# Idempotent — safe to run repeatedly. Use before re-launching to avoid double spawns.
set +e

echo "==> Killing native ROS / Gazebo / RViz processes (host WSL)"
pkill -f 'gz sim'             2>/dev/null
pkill -f 'gzserver'           2>/dev/null
pkill -f 'gzclient'           2>/dev/null
pkill -f 'rviz2'              2>/dev/null
pkill -f 'ros2 launch'        2>/dev/null
pkill -f 'ros2_control_node'  2>/dev/null
pkill -f 'robot_state_publisher' 2>/dev/null
pkill -f 'joint_state_publisher' 2>/dev/null
pkill -f 'move_group'         2>/dev/null
pkill -f 'rosbridge'          2>/dev/null
pkill -f 'controller_manager' 2>/dev/null
pkill -f 'spawner'            2>/dev/null

echo "==> Stopping docker containers"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE="$SCRIPT_DIR/../docker/docker-compose.yml"
if [ -f "$COMPOSE" ]; then
  docker compose -f "$COMPOSE" down --remove-orphans 2>/dev/null
fi

echo "==> Killing any straggler ROS processes inside containers (if still running)"
for c in $(docker ps -q --filter "label=com.docker.compose.project" 2>/dev/null); do
  docker exec "$c" bash -c 'pkill -f "ros2|rviz2|gazebo|gz sim|move_group|robot_state_publisher" 2>/dev/null' 2>/dev/null || true
done

echo "==> Force-removing vika containers"
for n in vika_ros vika_hmi; do
  docker rm -f "$n" 2>/dev/null
done

echo "==> Killing any remaining vite/node dev servers (HMI)"
pkill -f 'vite'  2>/dev/null
pkill -f 'pnpm dev' 2>/dev/null
# Windows-side pnpm dev is killed by user via Ctrl-C in its terminal.

# Quick check
echo ""
echo "==> Status after cleanup:"
docker ps --format '{{.Names}}: {{.Status}}' | grep -E 'vika|^$' || true
ss -tln 2>/dev/null | grep -E ':5173|:9090|:7400-7500' || echo "  (no vika ports in use)"
echo "==> Done."
