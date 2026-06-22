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

# Display: the physics server runs HEADLESS; the GUI is a separate client.
# On this Wayland + NVIDIA laptop, Gazebo's Qt GUI segfaults in libGLX_nvidia
# (Xwayland GLX), so the GUI client is forced onto Mesa's software GLX
# (__GLX_VENDOR_LIBRARY_NAME=mesa + llvmpipe) — slower but crash-free.
GUI_GL_ENV='export DISPLAY=:1 __GLX_VENDOR_LIBRARY_NAME=mesa LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe'
SRC='source /opt/ros/jazzy/setup.bash && source /ws/install/setup.bash'

stop_sim() {
  echo "==> Stopping VIKA sim processes in container"
  # NOTE: pkill -f matches against full command lines — including THIS shell's
  # own, which lists every pattern below. A bare pattern (e.g. "gz sim") would
  # make pkill -9 kill the killer (SIGKILL -> exit 137). The [g]-style bracket
  # trick matches the target ("gz sim") while the pattern string itself
  # ("[g]z sim") does not, so the shell never matches itself. Plain `bash -c`
  # (no -l) also avoids the login-profile errexit that aborts the loop early.
  # IMPORTANT: also kill the python nodes (bt_node, hmi_bridge, dino_detector) and
  # the move_group / web_video_server launched via `docker exec -d`. They are NOT
  # children of this script, so without an explicit kill every restart leaves the
  # OLD process running — you end up with several bt_nodes/hmi_bridges at once, the
  # stale ones running pre-edit code (places bricks at the wrong spot, IK fights).
  docker exec vika_ros bash -c \
    'for p in "[g]z sim" "[v]ika_bringup" "[r]osbridge" "[p]arameter_bridge" "[r]obot_state_publisher" "[s]pawner" "[b]t_node.py" "[h]mi_bridge.py" "[d]ino_detector.py" "[m]ove_group" "[w]eb_video_server"; do pkill -9 -f "$p" 2>/dev/null; done; true'
}

if [ "${1:-}" = "stop" ]; then stop_sim; exit 0; fi

echo "==> Granting X11 access for the container"
xhost + >/dev/null 2>&1 || echo "   (xhost failed — is an X server running on :1?)"

# Stable mDNS name for the dashboard: http://monumental.local:5173 (no more
# chasing the DHCP IP). avahi-publish holds the registration while it runs.
# match any private LAN IP (192.168/10/172.16-31), skip docker's 172.17; `|| true`
# so a no-match under `set -eo pipefail` doesn't abort the whole launch.
LANIP=$(ip -4 addr 2>/dev/null | grep -oE 'inet (192\.168|10|172)\.[0-9.]+' | awk '{print $2}' | grep -vE '^(172\.17|127\.)' | head -1) || true
if [ -n "$LANIP" ] && command -v avahi-publish >/dev/null 2>&1; then
  pkill -f 'avahi-publish.*monumental' 2>/dev/null || true
  nohup avahi-publish -a -R monumental.local "$LANIP" >/tmp/avahi-monumental.log 2>&1 &
  echo "==> mDNS: http://monumental.local:5173  ($LANIP)"
fi

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

echo "==> Launching Gazebo physics server (headless)"
docker exec -d vika_ros bash -c \
  "$SRC && export GZ_SIM_RESOURCE_PATH=/ws/install/vika_gazebo/share:/ws/install/vika_description/share && export GZ_SIM_SYSTEM_PLUGIN_PATH=/opt/ros/jazzy/lib && gz sim -r -s --headless-rendering $WORLD > /tmp/gz.log 2>&1"
sleep 6

echo "==> Launching Gazebo GUI client (Mesa software GLX — crash-free on NVIDIA/Wayland)"
docker exec -d vika_ros bash -c \
  "$GUI_GL_ENV && $SRC && gz sim -g --render-engine-gui ogre > /tmp/gz_gui.log 2>&1"
sleep 2

echo "==> Launching ROS stack (bridge + spawn robots + controllers)"
docker exec -d vika_ros bash -c \
  "$SRC && ros2 launch vika_bringup full_demo.launch.py > /tmp/full_demo.log 2>&1"
sleep 4

echo "==> Launching rosbridge (:9090)"
docker exec -d vika_ros bash -lc \
  "$SRC && ros2 launch rosbridge_server rosbridge_websocket_launch.xml > /tmp/rosbridge.log 2>&1"
sleep 2

echo "==> Launching web_video_server (:8080 — live wrist-cam MJPEG for the HMI)"
docker exec -d vika_ros bash -c \
  "$SRC && ros2 run web_video_server web_video_server --ros-args -p port:=8080 > /tmp/wvs.log 2>&1"
sleep 1

echo "==> Launching MoveIt move_group (robot_a — IK / Cartesian jog)"
docker exec -d vika_ros bash -c \
  "$SRC && ros2 launch vika_moveit robot_a_move_group.launch.py > /tmp/move_group.log 2>&1"
sleep 2

echo "==> Launching MoveIt move_group (robot_b — cement nozzle IK, namespaced)"
docker exec -d vika_ros bash -c \
  "$SRC && ros2 launch vika_moveit robot_b_move_group.launch.py > /tmp/move_group_b.log 2>&1"
sleep 2

echo "==> Launching HMI bridge (web dashboard -> joint/rail/IK/vacuum control)"
docker exec -d vika_ros bash -c \
  "$SRC && python3 /ws/src/vika_moveit/scripts/hmi_bridge.py > /tmp/hmi_bridge.log 2>&1"
sleep 1

echo "==> Launching AI brick detector (OPTIONAL — needs the perception add-on)"
if docker exec vika_ros bash -c "python3 -c 'import transformers, torch' 2>/dev/null"; then
  docker exec -d vika_ros bash -c \
    "$SRC && python3 /ws/src/vika_moveit/scripts/dino_detector.py > /tmp/dino.log 2>&1"
  echo "    Grounding DINO detector launched (GPU if available)"
else
  echo "    perception add-on not installed — DETECT disabled."
  echo "    Enable it: docker compose -f docker/docker-compose.yml build --build-arg WITH_PERCEPTION=1 ros"
  echo "    (or once, live: docker exec vika_ros bash /ws/../docker/install_perception.sh)"
fi
sleep 1

echo "==> Launching mission behavior tree (autonomous pick & place)"
docker exec -d vika_ros bash -c \
  "$SRC && python3 /ws/src/vika_moveit/scripts/bt_node.py > /tmp/bt.log 2>&1"
sleep 1

echo "==> Settling arm + resetting pick bricks onto pallet"
# Controllers engage ~8 s after spawn; wait for the arm to hold home, then drop
# the auto-attached pick bricks cleanly onto the pallet (längs row).
sleep 12
docker exec vika_ros bash /ws/src/vika_gazebo/scripts/reset_bricks.sh || true

echo "==> Folding both arms into the compact stow pose (no 'kissing' at centre)"
docker exec vika_ros bash -c \
  "source /opt/ros/jazzy/setup.bash && source /ws/install/setup.bash && python3 /ws/src/vika_moveit/scripts/fold_arms.py" || true

cat <<EOF

==> VIKA running (native Docker):
    HMI:       http://localhost:5173
    rosbridge: ws://localhost:9090
    Gazebo:    native window (GUI = Mesa software GLX; server headless)

    Logs:  docker exec vika_ros tail -f /tmp/gz.log
           docker exec vika_ros tail -f /tmp/full_demo.log
    Stop:  ./start-docker.sh stop
EOF
