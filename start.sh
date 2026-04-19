#!/usr/bin/env bash
# BrickBot — single-entry launch script (Angabe Section 3, line 88)
#
# Architecture (Option C: hybrid native + Docker):
#   - Gazebo Harmonic  : native WSL2 (GPU via WSLg)
#   - ROS2 Jazzy core  : native WSL2 (same user/namespace as gz → no partition hell)
#     - gz_ros2_control plugin, ros2_control, MoveIt2 deps, ros_gz_bridge
#   - Docker container : higher-level nodes (rosbridge, MCP, perception)
#                        connects via DDS on ROS_DOMAIN_ID=42 (network_mode: host)
#   - HMI Docker       : Vite dev server on :5173
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export ROS_DOMAIN_ID=42

# Force NVIDIA dGPU for WSLg rendering (laptop hybrid: Iris Xe + RTX 3080Ti)
export MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
export GALLIUM_DRIVER=d3d12

# Gazebo must find gz_ros2_control-system plugin (ships with ros-jazzy-gz-ros2-control)
export GZ_SIM_SYSTEM_PLUGIN_PATH="${GZ_SIM_SYSTEM_PLUGIN_PATH:-}:/opt/ros/jazzy/lib"

echo "==> Sourcing ROS2 Jazzy + workspace"
if [ ! -f /opt/ros/jazzy/setup.bash ]; then
  echo "ERROR: ROS2 Jazzy not installed natively. Run: sudo apt install ros-jazzy-desktop" >&2
  exit 1
fi
source /opt/ros/jazzy/setup.bash

if [ ! -f "$SCRIPT_DIR/brickbot_ws/install/setup.bash" ]; then
  echo "==> First-time colcon build"
  ( cd brickbot_ws && colcon build --event-handlers console_cohesion+ )
fi
source "$SCRIPT_DIR/brickbot_ws/install/setup.bash"

echo "==> Starting HMI container"
docker compose -f docker/docker-compose.yml up -d hmi

echo "==> Launching Gazebo Harmonic (native, GPU)"
WORLD="$SCRIPT_DIR/brickbot_ws/src/brickbot_gazebo/worlds/construction_site.sdf"
gz sim -r "$WORLD" &
GZ_PID=$!
sleep 4

echo "==> Launching ROS2 stack (spawn + bridge + controllers + rosbridge)"
ros2 launch brickbot_bringup full_demo.launch.py &
ROS_PID=$!

echo ""
echo "==> BrickBot running:"
echo "    HMI:       http://localhost:5173"
echo "    rosbridge: ws://localhost:9090"
echo "    Gazebo:    native window"
echo ""
echo "Press Ctrl+C to stop."

trap 'echo "==> Shutting down..."; kill $ROS_PID $GZ_PID 2>/dev/null || true; docker compose -f docker/docker-compose.yml down' INT TERM
wait
