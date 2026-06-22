#!/usr/bin/env bash
# Lay one wall SEGMENT (a row of 3 static bricks) for the multi-course wall, then
# respawn the used dynamic pick-row back onto its pallet slot so it can be picked
# again for the next course (the wall grows in Y as segments, in Z as courses).
#
# Args: <course_z> <wall_x> <seg_y> <row_model> <pick_y>
#   course_z   wall course index (height) -> brick centre z = course_z*0.238 + 0.119
#   wall_x     wall X (VIKA-6 side, -0.6)
#   seg_y      this segment's centre Y (already includes running-bond stagger)
#   row_model  the dynamic row just placed (e.g. row_2_0) -> respawn it
#   pick_y     the row's pallet slot Y (0.04 / 0.30 / 0.56)
# Run inside the vika_ros container (needs GZ_PARTITION to see the gz server).
export GZ_PARTITION=vika
source /opt/ros/jazzy/setup.bash 2>/dev/null
W=construction_site
SDF=/ws/src/vika_gazebo/models/wall_brick.sdf

Z=${1:-0}
WX=${2:--0.6}
SY=${3:-2.0}
ROW=${4:-row_0_0}
PY=${5:-0.04}
BH=0.238
ZB=$(python3 -c "print(round($Z*$BH + 0.119, 4))")   # box-centre z of the course

# 1) FIRST detach + whisk the just-placed DYNAMIC row back to its pallet slot, BEFORE
#    spawning the static bricks. This guarantees the two never occupy the wall at the
#    same time -> NO overlapping placement (overlap exploded the physics / looked like
#    bricks set on top of each other). There is a brief gap before the static appears
#    (a small cosmetic flicker), which is the accepted trade for zero overlap.
T="r${ROW#row_}"          # row_0_0 -> r0_0  (suction topic id)
for i in 1 2 3; do
  gz topic -t "/suction/${T}/detach" -m gz.msgs.Empty -p "" 2>/dev/null
  sleep 0.04
done
for i in 1 2; do
  gz service -s "/world/${W}/set_pose" \
    --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 4000 \
    --req "name: \"${ROW}\", position: {x: -0.6, y: ${PY}, z: 0.144}, orientation: {w: 1.0}" \
    >/dev/null 2>&1
  sleep 0.08
done

# 2) NOW the wall spot is clear — spawn the 3 STATIC wall bricks (along Y, yawed 90°,
#    centred at seg_y ±0.385). They are the only body at that spot -> no overlap.
for i in -1 0 1; do
  DY=$(python3 -c "print(round($SY + $i*0.385, 4))")
  gz service -s "/world/${W}/create" \
    --reqtype gz.msgs.EntityFactory --reptype gz.msgs.Boolean --timeout 4000 \
    --req "sdf_filename: \"${SDF}\", name: \"wall_${Z}_seg\", allow_renaming: true, pose: {position: {x: ${WX}, y: ${DY}, z: ${ZB}}, orientation: {z: 0.7071, w: 0.7071}}" \
    >/dev/null 2>&1
done
echo "seg z=${Z} y=${SY} laid (${ROW} respawned to pallet y=${PY})"
