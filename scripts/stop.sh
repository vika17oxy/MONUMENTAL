#!/usr/bin/env bash
# Stop: kill all RViz, JSP, RSP, ros2 launch, watcher.
# Container processes run as root; host pkill (as user) cannot kill them
# even with --pid=host. Use docker exec for the actual kills.
set +e

PATTERNS='rviz2|joint_state_publisher|joint_state_publisher_gui|robot_state_publisher|ros2 launch|view_base.launch|stat -c %Y'

# Kill inside container (root). This is the one that actually works.
if docker ps --filter name=vika_ros --format '{{.Names}}' | grep -q vika_ros; then
  docker exec vika_ros bash -c "
    pkill    -f \"$PATTERNS\" 2>/dev/null
    sleep 0.4
    pkill -9 -f \"$PATTERNS\" 2>/dev/null
  " 2>/dev/null
fi

# Best-effort host kill (only catches user-owned procs)
pkill -9 -f "$PATTERNS" 2>/dev/null
pkill -9 -f 'docker exec.*vika_ros' 2>/dev/null

# Verify
sleep 0.3
REMAINING=$(docker exec vika_ros bash -c "pgrep -af \"$PATTERNS\" 2>/dev/null" 2>/dev/null)
if [ -n "$REMAINING" ]; then
  echo "==> WARNING: still running:"
  echo "$REMAINING" | sed 's/^/    /'
  echo "==> Force-killing remaining"
  docker exec vika_ros bash -c "pgrep -f \"$PATTERNS\" | xargs -r kill -9" 2>/dev/null
fi

echo "==> Stopped: RViz / JSP / RSP / watcher"
