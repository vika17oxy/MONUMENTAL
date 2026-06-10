#!/usr/bin/env bash
# VIKA — single-entry launch script (Angabe Section 3, line 88)
#
# Architecture (Option C: hybrid native + Docker):
#   - Gazebo Harmonic  : native Linux (GPU via NVIDIA PRIME offload)
#   - ROS2 Jazzy core  : native Linux (same user/namespace as gz → no partition hell)
#     - gz_ros2_control plugin, ros2_control, MoveIt2 deps, ros_gz_bridge
#   - Docker container : higher-level nodes (rosbridge, MCP, perception)
#                        connects via DDS on ROS_DOMAIN_ID=42 (network_mode: host)
#   - HMI Docker       : Vite dev server on :5173
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export ROS_DOMAIN_ID=42

# Force NVIDIA dGPU for rendering (native Linux hybrid: Intel iGPU + RTX 3080Ti)
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Gazebo must find gz_ros2_control-system plugin (ships with ros-jazzy-gz-ros2-control)
export GZ_SIM_SYSTEM_PLUGIN_PATH="${GZ_SIM_SYSTEM_PLUGIN_PATH:-}:/opt/ros/jazzy/lib"

echo "==> Sourcing ROS2 Jazzy + workspace"
if [ ! -f /opt/ros/jazzy/setup.bash ]; then
  echo "ERROR: ROS2 Jazzy not installed natively. Run: sudo apt install ros-jazzy-desktop" >&2
  exit 1
fi
source /opt/ros/jazzy/setup.bash

if [ ! -f "$SCRIPT_DIR/vika_ws/install/setup.bash" ]; then
  echo "==> First-time colcon build"
  ( cd vika_ws && colcon build --event-handlers console_cohesion+ )
fi
source "$SCRIPT_DIR/vika_ws/install/setup.bash"

echo "==> Starting HMI container"
docker compose -f docker/docker-compose.yml up -d hmi

echo "==> Launching Gazebo Harmonic (native, GPU)"
WORLD="$SCRIPT_DIR/vika_ws/src/vika_gazebo/worlds/construction_site.sdf"
gz sim -r "$WORLD" &
GZ_PID=$!
sleep 4

echo "==> Launching ROS2 stack (spawn + bridge + controllers + rosbridge)"
ros2 launch vika_bringup full_demo.launch.py &
ROS_PID=$!

echo ""
echo "==> VIKA running:"
echo "    HMI:       http://localhost:5173"
echo "    rosbridge: ws://localhost:9090"
echo "    Gazebo:    native window"
echo ""
echo "Press Ctrl+C to stop."

trap 'echo "==> Shutting down..."; kill $ROS_PID $GZ_PID 2>/dev/null || true; docker compose -f docker/docker-compose.yml down' INT TERM
wait
