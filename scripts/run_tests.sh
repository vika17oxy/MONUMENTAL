#!/usr/bin/env bash
# VIKA test runner — unit tests (offline) + e2e smoke checks (needs a running sim).
#
#   ./scripts/run_tests.sh unit   # xacro / SRDF / config validation (no sim)
#   ./scripts/run_tests.sh e2e    # checks against a running ./start-docker.sh sim
#   ./scripts/run_tests.sh        # unit, then e2e if the sim is up
#
# Everything runs inside the vika_ros container (has ROS 2 + xacro + pytest).
set -uo pipefail
C="docker exec vika_ros bash -c"
SRC="source /opt/ros/jazzy/setup.bash && source /ws/install/setup.bash"
MODE="${1:-all}"
rc=0

run_unit() {
  echo "==> Unit tests (xacro / SRDF / config)"
  $C "$SRC && cd /ws && python3 -m pytest \
        src/vika_description/test/test_xacro.py \
        src/vika_moveit/test/test_config.py -q" || rc=1
}

run_e2e() {
  echo "==> E2E smoke checks (running simulation)"
  $C "$SRC && python3 /ws/src/vika_bringup/test/e2e_check.py" || rc=1
}

case "$MODE" in
  unit) run_unit ;;
  e2e)  run_e2e ;;
  all)  run_unit; echo; run_e2e ;;
  *) echo "usage: $0 [unit|e2e|all]"; exit 2 ;;
esac

echo
[ $rc -eq 0 ] && echo "==> ALL TESTS PASSED" || echo "==> SOME TESTS FAILED"
exit $rc
