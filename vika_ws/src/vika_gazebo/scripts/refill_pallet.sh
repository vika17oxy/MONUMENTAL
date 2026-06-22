#!/usr/bin/env bash
# Respawn all 3 dynamic pick-rows onto the pallet (flat 3x3 supply). Run by the BT
# ONLY after a whole wall course is laid — by then every row has been picked and
# stashed underground (lay_course.sh), so the pallet is empty and the 3 rows appear
# fresh. Does NOT touch the static wall_* bricks (unlike reset_bricks.sh).
#
# Run inside the vika_ros container (needs GZ_PARTITION to see the gz server).
export GZ_PARTITION=vika
source /opt/ros/jazzy/setup.bash 2>/dev/null
W=construction_site
declare -A PY=( [0]=0.04 [1]=0.3 [2]=0.56 )

# detach (in case still attached) then teleport each row up onto its pallet slot
for si in 0 1 2; do
  for i in 1 2; do
    gz topic -t "/suction/r${si}_0/detach" -m gz.msgs.Empty -p "" 2>/dev/null
    sleep 0.04
  done
done
sleep 0.4
for si in 0 1 2; do
  for i in 1 2; do
    gz service -s "/world/${W}/set_pose" \
      --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 4000 \
      --req "name: \"row_${si}_0\", position: {x: -0.6, y: ${PY[$si]}, z: 0.144}, orientation: {w: 1.0}" \
      >/dev/null 2>&1
    sleep 0.1
  done
done
echo "pallet refilled (row_0_0/1_0/2_0)"
