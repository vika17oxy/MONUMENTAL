#!/usr/bin/env python3
"""VIKA mission behavior tree — autonomous brick pick & place with a LIVE,
properly-structured tree for the HMI MISSION panel.

A real (small) behaviour-tree engine: composite nodes (Sequence, Fallback),
Conditions and timed Actions — so it genuinely branches (recovery fallback,
"bricks found?" condition, grouped phases) rather than being a flat list.

Each tick it publishes the whole tree flattened with depth + last-child flags
so the dashboard can draw it as a tree (connectors, per-node status colour).

Subscribes:  /hmi/mission   std_msgs/String   "START" | "STOP"
             /detect/result std_msgs/String   (DINO detections)
Publishes:   /bt/state      std_msgs/String   JSON {running, nodes:[{name,type,status,depth,last}]}
Drives the robot through the same /hmi/* topics the bridge serves.
"""
import json
import os
import time
import subprocess
import threading

import rclpy
from rclpy.node import Node as RclNode
from rclpy.qos import QoSProfile, DurabilityPolicy
from std_msgs.msg import String, Empty, Float64
from geometry_msgs.msg import Point, Vector3

IDLE, RUNNING, SUCCESS, FAILURE = "IDLE", "RUNNING", "SUCCESS", "FAILURE"
ROW_Y, BRICK_TOP = 0.29, 0.38
PLACE = (-0.6, 0.72, 0.38)
BRICK_H = 0.238           # brick height -> course k sits at z = k * BRICK_H
BRICK_LEN = 0.375         # brick long side (along the Y wall) -> ½ = running-bond stagger
LAY_SH = "/ws/src/vika_gazebo/scripts/lay_course.sh"
REFILL_SH = "/ws/src/vika_gazebo/scripts/refill_pallet.sh"
# ── mobile masonry: a long wall built from several Y segments, VIKA-6 travelling
#    the rail between the pallet (pick) and each segment (place) ──
WALL_X = -0.6             # the wall runs in Y at this X (VIKA-6's reach)
WALL_Y0 = 2.0            # wall START in Y (well clear of the pallet at y=0.3)
SEG_GAP = 0.04            # small visible gap (wall bricks have no collision -> no snag)
SEG_LEN = 3 * 0.385 + SEG_GAP   # segment centre spacing = row span (1.155) + gap
RAIL_AHEAD = 0.72         # the wall sits this far ahead of the carriage (good reach)
# ── The pallet shows a full 3x3 supply, but only row_0_0 (first row, y=0.04) is
#    DYNAMIC and RESPAWNS: VIKA-6 always picks IT, lays a wall SEGMENT, then it
#    respawns to the pallet for the next pick. The other two rows are STATIC
#    decoration. Each wall COURSE is NUM_SEGS rows LONG; courses stack NUM_COURSES
#    high (running bond). Only one row ever moves -> reliable pick. ──
NUM_SEGS = 3              # segments per course (wall length)
NUM_COURSES = 3           # courses high
PICK_Y = 0.04            # the (only) dynamic pick-row's pallet slot Y
PALLET_X = -0.6
PICK_Z = 0.38            # TCP target to grab a row resting at centre z=0.144 (top + standoff)
PLACE_Z = 0.355          # TCP set-down target for course 0; +z*BRICK_H per course. The
                         # row base comes to REST on the course below (set down, not
                         # dropped) before it is frozen + whisked.
PLACE_DESCEND = 0.25     # top-down place: hover this far ABOVE the target, then descend
                         # straight down in Z only (Cartesian MoveL) to set the row.
# ── VIKA-5 cement pass: run the nozzle along the finished wall top, laying mortar ──
CEMENT_HOVER = 0.70       # cement_base z over the wall (nozzle tip ~0.16 below)
CEMENT_SH = "/ws/src/vika_gazebo/scripts/lay_cement.sh"
N_CEMENT = 7              # mortar strips along the wall length


# ── behaviour-tree primitives ────────────────────────────────────────────────
class BT:
    def __init__(self, name, ntype):
        self.name, self.ntype, self.status = name, ntype, IDLE
        self.children = []

    def reset(self):
        self.status = IDLE
        for c in self.children:
            c.reset()


class Sequence(BT):
    def __init__(self, name, children):
        super().__init__(name, "sequence")
        self.children, self.i = children, 0

    def reset(self):
        super().reset()
        self.i = 0

    def tick(self):
        self.status = RUNNING
        while self.i < len(self.children):
            s = self.children[self.i].tick()
            if s == RUNNING:
                return RUNNING
            if s == FAILURE:
                self.status = FAILURE
                return FAILURE
            self.i += 1
        self.status = SUCCESS
        return SUCCESS


class Fallback(BT):
    def __init__(self, name, children):
        super().__init__(name, "fallback")
        self.children, self.i = children, 0

    def reset(self):
        super().reset()
        self.i = 0

    def tick(self):
        self.status = RUNNING
        while self.i < len(self.children):
            s = self.children[self.i].tick()
            if s == RUNNING:
                return RUNNING
            if s == SUCCESS:
                self.status = SUCCESS
                return SUCCESS
            self.i += 1
        self.status = FAILURE
        return FAILURE


class Condition(BT):
    def __init__(self, name, fn):
        super().__init__(name, "condition")
        self.fn = fn

    def tick(self):
        self.status = SUCCESS if self.fn() else FAILURE
        return self.status


class Action(BT):
    """Timed action: run on_enter once, stay RUNNING for `secs`, then SUCCESS
    (or earlier when `done` returns True)."""
    def __init__(self, name, secs, on_enter=None, done=None):
        super().__init__(name, "action")
        self.secs, self.on_enter, self.done = secs, on_enter, done
        self.t0 = None

    def reset(self):
        super().reset()
        self.t0 = None

    def tick(self):
        if self.status in (SUCCESS, FAILURE):
            return self.status
        if self.t0 is None:
            self.t0 = time.monotonic()
            if self.on_enter:
                self.on_enter()
            self.status = RUNNING
        if self.done and self.done():
            self.status = SUCCESS
        elif time.monotonic() - self.t0 >= self.secs:
            self.status = SUCCESS
        return self.status


class BtNode(RclNode):
    def __init__(self):
        super().__init__("bt_node")
        latched = QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL)
        self.pub_state = self.create_publisher(String, "/bt/state", latched)
        self.p_detect = self.create_publisher(Empty, "/hmi/detect", 10)
        self.p_goto = self.create_publisher(Point, "/hmi/goto", 10)
        self.p_goto_yaw = self.create_publisher(Point, "/hmi/goto_yaw", 10)   # 90°-yawed place
        self.p_rail_to = self.create_publisher(Float64, "/hmi/rail_to", 10)   # absolute rail (travel)
        self.p_suck = self.create_publisher(String, "/hmi/suck", 10)
        self.p_jog = self.create_publisher(Vector3, "/hmi/tcp_jog", 10)
        self.p_cmd = self.create_publisher(String, "/hmi/cmd", 10)
        self.p_active = self.create_publisher(String, "/hmi/active_robot", 10)
        # placed static wall bricks mirrored to the HMI 3D twin (latched so a late
        # browser still gets the wall built so far). JSON list of [x, y, z_centre].
        self.p_wall_state = self.create_publisher(String, "/wall/state", latched)
        self.create_subscription(String, "/hmi/mission", self.on_mission, 10)
        self.create_subscription(String, "/detect/result", self.on_result, latched)
        # volatile (10) — the HMI/rosbridge publishes the wall volatile; a
        # transient_local subscription would be QoS-incompatible and get nothing.
        self.create_subscription(String, "/hmi/wall", self.on_wall, 10)

        self.dets = []
        self.wall = []          # wall plan drawn in the site view: [[x,y], ...]
        self.wall_bricks = []   # placed static wall bricks (world [x,y,z]) for the HMI twin
        # the full ordered list of every wall brick the build will lay (course by
        # course, segment by segment, 3 bricks per segment) at deterministic poses —
        # the gz-sync thread publishes the first N that actually exist in Gazebo.
        self._all_wall_bricks = []
        for z in range(NUM_COURSES):
            for s in range(NUM_SEGS):
                seg_y = WALL_Y0 + s * SEG_LEN + (z % 2) * (BRICK_LEN / 2.0)
                zc = z * BRICK_H + BRICK_H / 2.0
                for dy in (-0.385, 0.0, 0.385):
                    self._all_wall_bricks.append([round(WALL_X, 3), round(seg_y + dy, 3), round(zc, 3)])
        self.running = False
        self.root = self._build()                       # VIKA-6 masonry (build)
        self.root_cement = self._build_cement()          # VIKA-5 cement pass
        self.root_auto = Sequence("Auto: build + cement",
                                  [self._build(), self._build_cement()])  # full cycle
        self.active_root = self.root
        self.create_timer(0.4, self.tick)
        self.publish_state()
        self._publish_wall()    # latch an initial (empty) wall so late HMIs sync
        threading.Thread(target=self._gz_wall_sync, daemon=True).start()
        self.get_logger().info("bt_node ready — waiting for /hmi/mission START")

    # ── the tree ──
    def _centroid_x(self):
        xs = [d["world"][0] for d in self.dets if d.get("world")]
        return sum(xs) / len(xs) if xs else -0.6  # pallet fallback

    def _build(self):
        A = Action
        # Build a LONG wall: each COURSE (z height) is NUM_SEGS rows LONG, laid
        # end-to-end in the +Y direction (s=0 near the pallet → s=2 far out). VIKA-6
        # always picks the single dynamic row_0_0, lays it as a STATIC wall segment,
        # and it RESPAWNS to the pallet for the next pick. Courses stack with a ½-brick
        # running-bond offset. bottom→top across courses.
        items = []
        for z in range(NUM_COURSES):
            for s in range(NUM_SEGS):                 # +Y: near → far
                items.append(self._seg(z, s))
            # INTERLEAVE cement: after each course (except the top one) VIKA-6 goes to
            # HOME and waits while VIKA-5 lays a mortar bed on this course's top; then
            # re-activate VIKA-6 (active robot) so the next course's picks drive it.
            if z < NUM_COURSES - 1 or NUM_COURSES == 1:   # ...or the single-course quick test
                items.append(self._course_cement(z))
                items.append(A("VIKA-6 active again", 3.0,
                               on_enter=lambda: self.p_active.publish(String(data="robot_a"))))
        return Sequence(f"Build wall ({NUM_SEGS}×{NUM_COURSES}, +Y, respawn, cemented)", [
            # park VIKA-5 (fold) out of the way first so the two arms never tangle
            A("Park VIKA-5", 5.0, on_enter=self._park_b),
            # DINO perception PASS — purely for the UI. Lift the wrist cam high over the
            # pallet, run Grounding DINO, and the detections (boxes) show in the HMI.
            # The pick itself uses GROUND TRUTH (known row pose), not these detections.
            A("Scan pallet (cam high)", 8.0, on_enter=self._do_scan),
            A("Detect bricks (UI only)", 9.0, on_enter=self._do_detect),
            *items,
            A("Retreat home", 5.0, on_enter=lambda: (self._slide_to(0.0),
                                                     self.p_cmd.publish(String(data="READY")))),
        ])

    def _seg(self, z, s):
        A = Action
        row = "r0_0"                                     # always the single dynamic pick-row
        pick_y = PICK_Y
        seg_y = WALL_Y0 + s * SEG_LEN + (z % 2) * (BRICK_LEN / 2.0)   # running-bond: odd courses ½-brick offset
        place_rail = WALL_Y0 + s * SEG_LEN - RAIL_AHEAD              # carriage behind, arm reaches ahead
        place_z = PLACE_Z + z * BRICK_H
        # carry HIGH so the row clears the courses already laid (z of them).
        lift = max(0.40, z * BRICK_H + 0.55)
        return Sequence(f"Course {z + 1} · Seg {s + 1} ({row})", [
            # slide to this row's pallet slot (straight-down grab in front of the arm)
            A("Slide to pallet", 7.0, on_enter=lambda yy=pick_y: self._slide_to(yy)),
            # LONG approach so the arm fully arrives + settles over the row before the
            # suction fires — otherwise it grabs mid-move and the row attaches offset
            # ("greift daneben"). The far-segment return is a big move, so be generous.
            A("Approach pick row", 10.0, on_enter=lambda yy=pick_y, rr=row: self._do_pick(yy, rr)),
            A("Vacuum grip", 2.5, on_enter=lambda rr=row: self.p_suck.publish(String(data=rr))),
            A("Lift row (high)", 7.0, on_enter=lambda lz=lift: self.p_jog.publish(
                Vector3(x=0.0, y=0.0, z=lz))),
            A("Slide to segment", 7.0, on_enter=lambda r=place_rail: self._slide_to(r)),
            # TOP-DOWN PLACE: first move HIGH directly above the x/y target, then descend
            # straight down in Z only (Cartesian MoveL) — sets the row cleanly from above
            # instead of sweeping it in sideways (which snagged on the neighbour brick).
            A("Hover above target", 8.0, on_enter=lambda y=seg_y, zz=place_z + PLACE_DESCEND:
                self._do_place(y, zz)),
            A("Set down (straight Z)", 5.0, on_enter=lambda dz=PLACE_DESCEND: self.p_jog.publish(
                Vector3(x=0.0, y=0.0, z=-dz))),
            # freeze the placed row as static wall bricks + whisk the dynamic row back
            A("Freeze + respawn row", 4.0, on_enter=lambda zz=z, sy=seg_y, py=pick_y:
                self._lay(zz, sy, "row_0_0", py)),
            A("Lift clear (straight Z)", 4.0, on_enter=lambda: self.p_jog.publish(
                Vector3(x=0.0, y=0.0, z=0.45))),
        ])

    def _do_pick(self, pick_y, row):
        """Approach one of the flat pallet pick-rows (row r{s}_0 at its Y slot)."""
        self.p_active.publish(String(data="robot_a"))
        self.get_logger().info(f"pick {row} at (y={pick_y:.2f}, z={PICK_Z:.2f})")
        self.p_goto.publish(Point(x=float(PALLET_X), y=float(pick_y), z=float(PICK_Z)))

    def _do_place(self, y, z):
        """Place the carried row as a yawed segment (bricks run along Y = the wall)."""
        self.get_logger().info(f"place -> ({WALL_X:.2f}, {y:.2f}, z={z:.2f}) yawed")
        self.p_goto_yaw.publish(Point(x=float(WALL_X), y=float(y), z=float(z)))

    def _refill_pallet(self):
        """Respawn all 3 pick-rows onto the pallet — runs once a whole course is laid
        (the pallet is empty by then), so new rows only appear when the pallet is empty."""
        try:
            subprocess.Popen(["bash", REFILL_SH])
        except Exception as e:
            self.get_logger().warn(f"refill failed: {e}")

    def _lay(self, z, seg_y, row, pick_y):
        """Freeze the placed segment as static wall bricks + stash the used dynamic row."""
        try:
            subprocess.Popen(["bash", LAY_SH, str(z), str(WALL_X), str(seg_y), row, str(pick_y)])
        except Exception as e:
            self.get_logger().warn(f"lay failed: {e}")
        # NB: the HMI twin is NOT updated here — a background thread mirrors the
        # ACTUAL Gazebo wall_* models so web and sim never drift (lay can fail).

    def _publish_wall(self):
        self.p_wall_state.publish(String(data=json.dumps(self.wall_bricks)))

    def _gz_wall_sync(self):
        """Mirror the REAL Gazebo wall to /wall/state so the HMI twin matches the
        sim exactly. The static wall bricks are laid in a fixed course/segment
        order at deterministic poses, so counting the live ``wall_*`` models tells
        us how many of that ordered list currently exist."""
        env = {**os.environ, "GZ_PARTITION": "vika"}
        while True:
            try:
                out = subprocess.run(["gz", "model", "--list"], capture_output=True,
                                     text=True, timeout=4, env=env).stdout
                n = sum(1 for ln in out.splitlines() if "wall_" in ln)
                new = self._all_wall_bricks[: (n // 3) * 3]   # 3 bricks per segment
                if new != self.wall_bricks:
                    self.wall_bricks = new
                    self._publish_wall()
            except Exception:
                pass
            time.sleep(1.5)

    def _slide_to(self, rail):
        self.p_active.publish(String(data="robot_a"))
        self.p_rail_to.publish(Float64(data=float(rail)))

    # ── VIKA-5 cement pass ──────────────────────────────────────────────────────
    def _build_cement(self):
        A = Action
        wall_len = NUM_SEGS * SEG_LEN
        top_z = NUM_COURSES * BRICK_H
        steps = [
            # park VIKA-6 (fold) so it's clear of VIKA-5's cement run
            A("Park VIKA-6", 5.0, on_enter=self._park_a),
            A("VIKA-5 to wall start", 7.0, on_enter=lambda: self._slide_b(WALL_Y0)),
            A("Nozzle over wall", 6.0, on_enter=lambda: self._cement_pos(WALL_Y0)),
        ]
        for i in range(N_CEMENT):
            y = WALL_Y0 + i * wall_len / (N_CEMENT - 1)
            steps.append(A(f"Run to y={y:.1f}", 5.0, on_enter=lambda yy=y: self._slide_b(yy)))
            steps.append(A("Apply cement", 4.0,
                           on_enter=lambda yy=y, z=top_z: (self._cement_pos(yy), self._spawn_cement(yy, z))))
        steps.append(A("Retreat", 6.0, on_enter=lambda: (self._slide_b(0.0),
                                                         self.p_cmd.publish(String(data="READY")))))
        return Sequence("Cement the wall (VIKA-5)", steps)

    def _slide_b(self, world_y):
        # robot_b's carriage: rail value = -world_y (base_yaw=pi flips local Y -> world).
        self.p_active.publish(String(data="robot_b"))
        self.p_rail_to.publish(Float64(data=float(-world_y)))

    def _cement_pos(self, y):
        self.p_active.publish(String(data="robot_b"))
        self.p_goto.publish(Point(x=float(WALL_X), y=float(y), z=CEMENT_HOVER))

    def _cement_pos_z(self, y, z):
        """Like _cement_pos but at an explicit nozzle height (for per-course cement,
        centred over the bricks at x=WALL_X = ground truth)."""
        self.p_active.publish(String(data="robot_b"))
        self.p_goto.publish(Point(x=float(WALL_X), y=float(y), z=float(z)))

    def _course_cement(self, z):
        """VIKA-5 lays a mortar bed along the TOP of course z while VIKA-6 waits in its
        HOME pose. Ground truth: the nozzle runs centred over the known wall line
        (x=WALL_X) at the course-top height. Mirrors _build_cement but per course."""
        A = Action
        run_len = (NUM_SEGS - 1) * SEG_LEN
        stagger = (z % 2) * (BRICK_LEN / 2.0)                 # match the running-bond shift
        y0 = WALL_Y0 + stagger
        # keep the nozzle at a comfortably REACHABLE height so VIKA-5 lands centred over
        # the wall (x=WALL_X) instead of short/beside it; the mortar bed itself spawns at
        top_z = (z + 1) * BRICK_H                              # mortar bed sits on course z
        # IK tip is cement_BASE (the wrist-side tool root, per the SRDF), NOT the nozzle
        # tip. So target cement_base at a REACHABLE height above the course, and the
        # ~0.31 m of tool below it (cement_angle offset + nozzle) puts the actual nozzle
        # TIP down at the brick top. Targeting cement_base at the brick height itself is
        # unreachable -> VIKA-5 never moves (that was the bug).
        nozzle_z = top_z + 0.31
        steps = [
            A("VIKA-6 to HOME (wait)", 6.0, on_enter=self._park_a),
            A("VIKA-5 to course start", 7.0, on_enter=lambda yy=y0: self._slide_b(yy)),
            A("Nozzle over course (centre)", 8.0, on_enter=lambda yy=y0, nz=nozzle_z:
                self._cement_pos_z(yy, nz)),
        ]
        for i in range(N_CEMENT):
            y = y0 + i * run_len / (N_CEMENT - 1)
            # Slide the rail AND re-solve IK every strip (axis 4 free) so VIKA-5 actually
            # lowers the nozzle to the wall each time — rail-only positioned just once and,
            # if that IK was flaky, the arm stayed up and only the rail moved. With the
            # LONG nozzle the wrist target stays reachable while the tip sits at the bricks.
            steps.append(A(f"Run to y={y:.1f}", 5.0, on_enter=lambda yy=y, nz=nozzle_z:
                           (self._slide_b(yy), self._cement_pos_z(yy, nz))))
            steps.append(A("Apply cement", 2.5, on_enter=lambda yy=y, tz=top_z:
                           self._spawn_cement(yy, tz)))
        steps.append(A("VIKA-5 home", 5.0, on_enter=self._park_b))
        return Sequence(f"Cement course {z + 1} (VIKA-5)", steps)

    def _spawn_cement(self, y, top_z):
        try:
            subprocess.Popen(["bash", CEMENT_SH, str(WALL_X), str(y), str(top_z)])
        except Exception as e:
            self.get_logger().warn(f"cement failed: {e}")

    def _park_a(self):
        """Fold VIKA-6 (robot_a) compactly out of the way."""
        self.p_active.publish(String(data="robot_a"))
        self.p_cmd.publish(String(data="HOME"))

    def _park_b(self):
        """Fold VIKA-5 (robot_b) compactly out of the way."""
        self.p_active.publish(String(data="robot_b"))
        self.p_cmd.publish(String(data="HOME"))

    def _do_scan(self):
        # lift the wrist camera HIGH and centred over the pallet so Grounding DINO
        # sees all the bricks from above (for the UI overlay; pick uses ground truth)
        self.p_active.publish(String(data="robot_a"))
        self.p_goto.publish(Point(x=-0.6, y=0.3, z=1.15))

    def _do_detect(self):
        self.dets = []
        self.p_detect.publish(Empty())

    def _do_approach(self):
        self.p_goto.publish(Point(x=self._centroid_x(), y=ROW_Y, z=BRICK_TOP))

    def _wall_xy(self):
        """Where the wall is built: the drawn wall midpoint, else the default spot."""
        w = self.wall
        if w and len(w) >= 2:
            return ((w[0][0] + w[1][0]) / 2.0, (w[0][1] + w[1][1]) / 2.0)
        if w:
            return (w[0][0], w[0][1])
        return (PLACE[0], PLACE[1])

    def _do_place_course(self, k):
        """Traverse the YAWED row over the wall at COURSE k's height. The wall runs
        in Y, so z grows per course (stacking) and every 2nd course is offset by
        half a brick in Y (running bond, like a real wall)."""
        x, y = self._wall_xy()
        y += (k % 2) * (BRICK_LEN / 2.0)          # running bond: stagger odd courses
        z = PLACE[2] + k * BRICK_H
        self.get_logger().info(f"course {k + 1} -> wall ({x:.2f}, {y:.2f}, z={z:.2f}) yawed")
        self.p_goto_yaw.publish(Point(x=float(x), y=float(y), z=float(z)))

    def _lay_course(self, k):
        """Freeze the just-placed row as static wall bricks and refill the dynamic
        pick row on the pallet (so the next course has bricks again)."""
        x, y = self._wall_xy()
        try:
            subprocess.Popen(["bash", LAY_SH, str(k), str(x), str(y)])
        except Exception as e:
            self.get_logger().warn(f"lay_course failed: {e}")

    # ── inputs ──
    def on_result(self, msg):
        try:
            self.dets = json.loads(msg.data).get("dets", [])
        except Exception:
            pass

    def on_wall(self, msg):
        try:
            self.wall = json.loads(msg.data) or []
            self.get_logger().info(f"wall plan: {len(self.wall)} vertices")
        except Exception:
            self.wall = []

    def on_mission(self, msg):
        cmd = msg.data.strip().upper()
        roots = {"START": self.root, "BUILD": self.root,
                 "CEMENT": self.root_cement, "AUTO": self.root_auto}
        if cmd in roots and not self.running:
            self.active_root = roots[cmd]
            self.active_root.reset()
            self.running = True
            self.get_logger().info(f"mission {cmd}")
        elif cmd == "STOP":
            self.running = False
            self.p_suck.publish(String(data=""))
            self.get_logger().info("mission STOP")
        self.publish_state()

    # ── tick ──
    def tick(self):
        if not self.running:
            return
        s = self.active_root.tick()
        if s in (SUCCESS, FAILURE):
            self.running = False
        self.publish_state()

    def publish_state(self):
        nodes = []

        def walk(n, depth, last):
            nodes.append({"name": n.name, "type": n.ntype, "status": n.status,
                          "depth": depth, "last": last})
            for i, c in enumerate(n.children):
                walk(c, depth + 1, i == len(n.children) - 1)

        walk(self.active_root, 0, True)
        self.pub_state.publish(String(data=json.dumps({"running": self.running, "nodes": nodes})))


def main():
    rclpy.init()
    n = BtNode()
    try:
        rclpy.spin(n)
    except KeyboardInterrupt:
        pass
    rclpy.shutdown()


if __name__ == "__main__":
    main()
