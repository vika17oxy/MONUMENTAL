#!/usr/bin/env bash
# VIKA — native-Linux Docker launcher (no WSL, no native ROS install required).
#
# Brings up the whole stack inside the vika/ros container:
#   - Gazebo Harmonic   : GUI rendered on the Intel iGPU (stable), NVIDIA stays
#                         available for compute/sensors via the NVIDIA runtime
#   - ros_gz_bridge + robot spawn (vika_bringup full_demo)
#   - rosbridge_server  : ws://localhost:9090 for the web HMI
#   - HMI (vika_hmi)    : http://localhost:5173 (separate container)
#
# Usage:  ./start-docker.sh         # start everything
#         ./start-docker.sh stop    # stop the sim processes (containers stay up)
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
COMPOSE="docker compose -f docker/docker-compose.yml"
WORLD="/ws/src/vika_gazebo/worlds/construction_site.sdf"

# GUI: X11 passthrough + NVIDIA dGPU (runtime: nvidia in compose). Gazebo's GUI is
# pinned to the ogre1 render engine — ogre2 segfaults on NVIDIA/Xwayland.
GUI_ENV='export DISPLAY=:1'
GZ_GUI_ENGINE='--render-engine-gui ogre'
SRC='source /opt/ros/jazzy/setup.bash && source /ws/install/setup.bash'

stop_sim() {
  echo "==> Stopping VIKA sim processes in container"
  docker exec vika_ros bash -lc \
    'pkill -9 -f "gz sim" ; pkill -9 -f full_demo ; pkill -9 -f parameter_bridge ; pkill -9 -f robot_state_publisher ; pkill -9 -f rosbridge ; true'
}

if [ "${1:-}" = "stop" ]; then stop_sim; exit 0; fi

echo "==> Granting X11 access for the container"
xhost + >/dev/null 2>&1 || echo "   (xhost failed — is an X server running on :1?)"

echo "==> Starting containers (ros + hmi)"
$COMPOSE up -d

echo "==> Waiting for vika_ros"
until docker exec vika_ros true 2>/dev/null; do sleep 1; done

echo "==> Building colcon workspace if needed"
docker exec vika_ros bash -lc \
  'source /opt/ros/jazzy/setup.bash && cd /ws && [ -f install/setup.bash ] || colcon build --symlink-install'

# Clean slate so we never get duplicate robot_state_publishers / stale spawns.
stop_sim
sleep 1

echo "==> Launching Gazebo (NVIDIA dGPU, ogre1 GUI)"
docker exec -d vika_ros bash -lc \
  "$GUI_ENV && $SRC && export GZ_SIM_RESOURCE_PATH=/ws/install/vika_gazebo/share:/ws/install/vika_description/share && export GZ_SIM_SYSTEM_PLUGIN_PATH=/opt/ros/jazzy/lib && gz sim -r $GZ_GUI_ENGINE $WORLD > /tmp/gz.log 2>&1"
sleep 5

echo "==> Launching ROS stack (bridge + spawn robots)"
docker exec -d vika_ros bash -lc \
  "$SRC && ros2 launch vika_bringup full_demo.launch.py > /tmp/full_demo.log 2>&1"
sleep 4

echo "==> Launching rosbridge (:9090)"
docker exec -d vika_ros bash -lc \
  "$SRC && ros2 launch rosbridge_server rosbridge_websocket_launch.xml > /tmp/rosbridge.log 2>&1"
sleep 2

cat <<EOF

==> VIKA running (native Docker):
    HMI:       http://localhost:5173
    rosbridge: ws://localhost:9090
    Gazebo:    native window (Intel-iGPU)

    Logs:  docker exec vika_ros tail -f /tmp/gz.log
           docker exec vika_ros tail -f /tmp/full_demo.log
    Stop:  ./start-docker.sh stop
EOF
