#!/usr/bin/env bash
# Lay one masonry course for the multi-course wall build:
#   1) spawn 3 STATIC wall bricks at the course target (the wall grows + persists)
#   2) detach + teleport the 3 DYNAMIC pick bricks back to the pallet (fast — one
#      set_pose each) so VIKA-6 can pick them again for the next course.
#
# Args: <course_idx> <wall_x> <wall_y>
# Run inside the vika_ros container (needs GZ_PARTITION to see the gz server).
export GZ_PARTITION=vika
source /opt/ros/jazzy/setup.bash 2>/dev/null
W=construction_site
SDF=/ws/src/vika_gazebo/models/wall_brick.sdf

IDX=${1:-0}
WX=${2:--0.6}
WY=${3:-0.72}
BH=0.238                       # brick height -> course z = IDX*BH
ZB=$(python3 -c "print(round($IDX*$BH + 0.119, 4))")   # box-centre z of the course

# 1) spawn the 3 static wall bricks ALONG Y (the wall runs in Y), yawed 90° so the
#    brick long side runs in Y. Every 2nd course is staggered half a brick (running
#    bond) so the vertical joints don't line up — like a real masonry wall.
OFFY=$(python3 -c "print(($IDX % 2) * 0.1875)")
WYC=$(python3 -c "print(round($WY + $OFFY, 4))")
for i in -1 0 1; do
  DY=$(python3 -c "print(round($WYC + $i*0.385, 4))")
  gz service -s "/world/${W}/create" \
    --reqtype gz.msgs.EntityFactory --reptype gz.msgs.Boolean --timeout 4000 \
    --req "sdf_filename: \"${SDF}\", name: \"wall_${IDX}_${i}\", allow_renaming: true, pose: {position: {x: ${WX}, y: ${DY}, z: ${ZB}}, orientation: {z: 0.7071, w: 0.7071}}" \
    >/dev/null 2>&1
done

# 2) detach + teleport the single dynamic pick-ROW (row_0_0) back onto the pallet
#    (längs row centred at x=-0.6, y=0.3, z=0.144) so VIKA-6 can pick it again for
#    the next course. Repeat detach (single pub often lost), settle, then set_pose.
for i in 1 2 3; do
  gz topic -t "/suction/r0_0/detach" -m gz.msgs.Empty -p "" 2>/dev/null
  sleep 0.05
done
sleep 0.4
for i in 1 2; do
  gz service -s "/world/${W}/set_pose" \
    --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 4000 \
    --req "name: \"row_0_0\", position: {x: -0.6, y: 0.3, z: 0.144}, orientation: {w: 1.0}" \
    >/dev/null 2>&1
  sleep 0.12
done
echo "course ${IDX} laid at (${WX}, ${WY}), z=$(python3 -c "print($IDX*$BH)")"
