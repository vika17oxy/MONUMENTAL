#!/usr/bin/env bash
# Reset the dynamic pick bricks onto the pallet in the LÄNGS row.
#
# gz DetachableJoint auto-attaches at load, and during the brief window before
# the arm controllers engage the arm collapses and drags the attached bricks
# away. So once everything is up we (1) detach all pads and (2) teleport each
# brick back to its resting pose on the pallet. Run inside the vika_ros
# container; needs GZ_PARTITION to see the server.
# NOTE: do NOT use `set -u` here — `source setup.bash` references unset vars and
# would abort the script before the detach ever runs (this silently broke the
# reset, leaving the auto-attached bricks dangling off the gripper).
export GZ_PARTITION=vika
source /opt/ros/jazzy/setup.bash 2>/dev/null
W=construction_site

# ONE dynamic pick-row row_0_0 (first row, y=0.04) is reset onto the pallet. The other
# two rows (row_1_0/row_2_0) are STATIC decoration in the SDF and never move, so they
# need no reset. The wall grows as STATIC wall_* bricks (lay_course.sh).

# Clear any wall the multi-course build laid (static wall_* bricks), so a fresh
# run starts on a clean slate instead of stacking on top of the old wall.
# `gz model --list` prints "    - wall_0_0" — take the LAST field so we get the
# bare model name (not "-wall_0_0", which the remove service won't match).
for m in $(gz model --list 2>/dev/null | grep -E 'wall_|cement' | awk '{print $NF}'); do
  gz service -s "/world/${W}/remove" \
    --reqtype gz.msgs.Entity --reptype gz.msgs.Boolean --timeout 3000 \
    --req "name: \"${m}\", type: MODEL" >/dev/null 2>&1
done

# Detach the pick-row — fire-and-forget, repeat (single pub often lost).
for i in 1 2 3 4; do
  gz topic -t "/suction/r0_0/detach" -m gz.msgs.Empty -p "" 2>/dev/null
  sleep 0.05
done
# Let the joint removal settle before teleporting (fixed joint overrides set_pose).
sleep 3.0
# Drop row_0_0 flat onto its pallet slot (y=0.04).
for i in 1 2 3; do
  gz service -s "/world/${W}/set_pose" \
    --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 4000 \
    --req "name: \"row_0_0\", position: {x: -0.6, y: 0.04, z: 0.144}, orientation: {w: 1.0}" \
    >/dev/null 2>&1
  sleep 0.15
done
echo "==> pick-row reset onto pallet (row_0_0 @ y=0.04)"
