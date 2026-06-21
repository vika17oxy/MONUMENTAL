#!/usr/bin/env bash
# Spawn one static grey mortar strip on the wall top — called by the cement BT as
# VIKA-5 runs its nozzle along the wall. Args: <wall_x> <y> <top_z>
export GZ_PARTITION=vika
source /opt/ros/jazzy/setup.bash 2>/dev/null
W=construction_site
SDF=/ws/src/vika_gazebo/models/cement_strip.sdf
WX=${1:--0.6}
Y=${2:-2.0}
TOPZ=${3:-0.476}
ZC=$(python3 -c "print(round($TOPZ + 0.02, 4))")     # strip centre just above the top course
gz service -s "/world/${W}/create" \
  --reqtype gz.msgs.EntityFactory --reptype gz.msgs.Boolean --timeout 4000 \
  --req "sdf_filename: \"${SDF}\", name: \"cement\", allow_renaming: true, pose: {position: {x: ${WX}, y: ${Y}, z: ${ZC}}}" \
  >/dev/null 2>&1
echo "cement strip at (${WX}, ${Y}, ${ZC})"
