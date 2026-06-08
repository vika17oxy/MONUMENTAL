#!/usr/bin/env bash
# Start Gazebo Harmonic NATIVELY in WSL (GPU via WSLg) with ROS sourced
# so gz_ros2_control plugin can load when robot is spawned.
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Killing prior Gazebo (host + container)"
pkill -9 -f 'gz sim'   2>/dev/null || true
pkill -9 -f 'gzserver' 2>/dev/null || true
docker exec vika_ros bash -c 'pkill -9 -f "gz sim|gzserver" 2>/dev/null' 2>/dev/null || true
sleep 0.5

# Source native ROS Jazzy (for gz_ros2_control plugin path + DDS env)
if [ -f /opt/ros/jazzy/setup.bash ]; then
  source /opt/ros/jazzy/setup.bash
else
  echo "WARN: /opt/ros/jazzy/setup.bash not found — gz_ros2_control plugin may not load"
fi

# Match docker container's domain so MoveIt/spawners can talk to gz_ros2_control
export ROS_DOMAIN_ID=42

# WSL2 GPU passthrough — without these WSLg uses llvmpipe (CPU = black window)
export GALLIUM_DRIVER=d3d12
export MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
export LIBGL_ALWAYS_SOFTWARE=0

# Force localhost discovery (WSL2 multicast unreliable)
export GZ_PARTITION=vika
export GZ_IP=127.0.0.1

# So Gazebo finds gz_ros2_control-system.so plugin shipped with ROS Jazzy
export GZ_SIM_SYSTEM_PLUGIN_PATH="${GZ_SIM_SYSTEM_PLUGIN_PATH:-}:/opt/ros/jazzy/lib"

# Resource paths so brick.stl mesh can be found by Gazebo
export GZ_SIM_RESOURCE_PATH="$ROOT/vika_ws/src/vika_description:$ROOT/vika_ws/src/vika_gazebo:${GZ_SIM_RESOURCE_PATH:-}"

WORLD="$ROOT/vika_ws/src/vika_gazebo/worlds/construction_site.sdf"

echo "==> Launching Gazebo (native WSL, GPU via WSLg)"
echo "    ROS_DOMAIN_ID=$ROS_DOMAIN_ID  GZ_PARTITION=$GZ_PARTITION"
echo "    World: $WORLD"
exec gz sim -r -v 3 "$WORLD"
