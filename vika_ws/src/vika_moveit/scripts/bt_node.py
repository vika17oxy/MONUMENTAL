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
import time
import subprocess

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
# ── mobile masonry: a long wall built from several Y segments, VIKA-6 travelling
#    the rail between the pallet (pick) and each segment (place) ──
WALL_X = -0.6             # the wall runs in Y at this X (VIKA-6's reach)
WALL_Y0 = 2.0            # wall START in Y (well clear of the pallet at y=0.3)
SEG_LEN = 3 * 0.385       # one pick = a row of 3 bricks -> contiguous segments
RAIL_AHEAD = 0.72         # the wall sits this far ahead of the carriage (good reach)
# ── real 3(Y)×4(Z) pallet of fused pick-ROWS row_{yi}_{zi} (12 rows, NO respawn).
#    Each pallet COLUMN (yi) supplies one wall COURSE; its 4 LEVELS (zi, top-down)
#    supply that course's 4 SEGMENTS. Ground-truth pick (the known stack), not DINO. ──
NUM_Y = 3                 # pallet Y-columns  == wall courses
NUM_LEVELS = 4            # pallet Z-levels   == wall segments
NUM_SEGS = NUM_LEVELS     # 4 segments along Y
NUM_COURSES = NUM_Y       # 3 courses high
ROWY = {0: 0.04, 1: 0.3, 2: 0.56}   # the 3 längs rows along Y (ground-truth pick Y)
PALLET_X = -0.6
# ── respawn build (stable 3-wide × 3-high wall): ONE dynamic pick-row row_0_0 on
#    the pallet is picked, laid as a course of STATIC wall bricks, then teleported
#    back for the next course. Nothing stacks on the pallet -> nothing topples. ──
PICK_Y = 0.3              # pallet pick row Y (carriage slides here to grab straight down)
PICK_Z = 0.38            # TCP target to grab a row resting at centre z=0.144 (top + standoff)
WALL_Y = 1.3              # the 3-brick wall sits here in Y, clear of the pallet (ends at y≈0.8)
PLACE_Z = 0.38           # TCP target for course 0; +k*BRICK_H per course
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
        self.create_subscription(String, "/hmi/mission", self.on_mission, 10)
        self.create_subscription(String, "/detect/result", self.on_result, latched)
        # volatile (10) — the HMI/rosbridge publishes the wall volatile; a
        # transient_local subscription would be QoS-incompatible and get nothing.
        self.create_subscription(String, "/hmi/wall", self.on_wall, 10)

        self.dets = []
        self.wall = []          # wall plan drawn in the site view: [[x,y], ...]
        self.running = False
        self.root = self._build()                       # VIKA-6 masonry (build)
        self.root_cement = self._build_cement()          # VIKA-5 cement pass
        self.root_auto = Sequence("Auto: build + cement",
                                  [self._build(), self._build_cement()])  # full cycle
        self.active_root = self.root
        self.create_timer(0.4, self.tick)
        self.publish_state()
        self.get_logger().info("bt_node ready — waiting for /hmi/mission START")

    # ── the tree ──
    def _centroid_x(self):
        xs = [d["world"][0] for d in self.dets if d.get("world")]
        return sum(xs) / len(xs) if xs else -0.6  # pallet fallback

    def _build(self):
        A = Action
        scan = A("Scan pose", 7.0, on_enter=self._do_scan)
        detect = A("Detect bricks", 8.0, on_enter=self._do_detect, done=lambda: len(self.dets) > 0)
        found = Condition("bricks found?", lambda: len(self.dets) > 0)
        rescan = A("Re-scan", 8.0, on_enter=self._do_detect, done=lambda: len(self.dets) > 0)
        # Build a stable 3-wide × NUM_COURSES-high wall by laying ONE pick-row per
        # course: pick row_0_0, place it as a course, freeze it as STATIC wall bricks
        # and teleport the dynamic row back to the pallet for the next course. Nothing
        # ever stacks on the pallet, so nothing topples there; the wall is static.
        courses = [self._course(k) for k in range(NUM_COURSES)]
        return Sequence(f"Build wall (3 wide × {NUM_COURSES} high, respawn)", [
            # park VIKA-5 (fold) out of the way first so the two arms never tangle
            A("Park VIKA-5", 5.0, on_enter=self._park_b),
            *courses,
            A("Retreat home", 5.0, on_enter=lambda: (self._slide_to(0.0),
                                                     self.p_cmd.publish(String(data="READY")))),
        ])

    def _course(self, k):
        A = Action
        place_y = WALL_Y + (k % 2) * (BRICK_LEN / 2.0)   # running-bond ½-brick stagger
        place_rail = WALL_Y - RAIL_AHEAD                 # carriage sits behind, arm reaches ahead
        place_z = PLACE_Z + k * BRICK_H
        # carry HIGH: clear the courses already laid (k of them) plus the pallet row.
        lift = max(0.40, k * BRICK_H + 0.55)
        return Sequence(f"Course {k + 1}/{NUM_COURSES}", [
            # slide to the pallet pick row (straight-down grab in front of the arm)
            A("Slide to pallet", 6.0, on_enter=lambda: self._slide_to(PICK_Y)),
            A("Approach pick row", 6.0, on_enter=self._do_pick),
            A("Vacuum grip", 2.5, on_enter=lambda: self.p_suck.publish(String(data="r0_0"))),
            A("Lift row (high)", 7.0, on_enter=lambda lz=lift: self.p_jog.publish(
                Vector3(x=0.0, y=0.0, z=lz))),
            A("Slide to wall", 7.0, on_enter=lambda r=place_rail: self._slide_to(r)),
            A("Place course (yawed)", 8.0, on_enter=lambda y=place_y, z=place_z:
                self._do_place(y, z)),
            A("Lower onto course", 4.5, on_enter=lambda: self.p_jog.publish(
                Vector3(x=0.0, y=0.0, z=-0.14))),
            A("Release", 2.0, on_enter=lambda: self.p_suck.publish(String(data=""))),
            A("Lift clear", 4.0, on_enter=lambda: self.p_jog.publish(Vector3(x=0.0, y=0.0, z=0.45))),
            # freeze this course as static wall bricks + teleport row_0_0 back to pallet
            A("Freeze course + refill", 3.5, on_enter=lambda kk=k: self._lay_seg(WALL_Y, kk)),
        ])

    def _do_pick(self):
        """Approach the single dynamic pick-row row_0_0 resting on the pallet."""
        self.p_active.publish(String(data="robot_a"))
        self.get_logger().info(f"pick row r0_0 at (y={PICK_Y:.2f}, z={PICK_Z:.2f})")
        self.p_goto.publish(Point(x=float(PALLET_X), y=float(PICK_Y), z=float(PICK_Z)))

    def _do_place(self, y, z):
        """Place the carried row as a yawed course (bricks run along Y = the wall)."""
        self.get_logger().info(f"place course -> ({WALL_X:.2f}, {y:.2f}, z={z:.2f}) yawed")
        self.p_goto_yaw.publish(Point(x=float(WALL_X), y=float(y), z=float(z)))

    def _slide_to(self, rail):
        self.p_active.publish(String(data="robot_a"))
        self.p_rail_to.publish(Float64(data=float(rail)))

    def _do_pick_row(self, yi, zi):
        """Approach pallet row (column yi, level zi) at its brick top — ground truth
        (the known stack geometry), not the DINO centroid."""
        self.p_active.publish(String(data="robot_a"))
        z = BRICK_TOP + zi * BRICK_H
        self.get_logger().info(f"pick row {yi}_{zi} at (y={ROWY[yi]:.2f}, z={z:.2f})")
        self.p_goto.publish(Point(x=float(PALLET_X), y=float(ROWY[yi]), z=float(z)))

    def _do_place_seg(self, seg_y, k):
        y = seg_y + (k % 2) * (BRICK_LEN / 2.0)      # running-bond stagger
        z = PLACE[2] + k * BRICK_H
        self.get_logger().info(f"seg place -> ({WALL_X:.2f}, {y:.2f}, z={z:.2f}) yawed")
        self.p_goto_yaw.publish(Point(x=float(WALL_X), y=float(y), z=float(z)))

    def _lay_seg(self, seg_y, k):
        try:
            subprocess.Popen(["bash", LAY_SH, str(k), str(WALL_X), str(seg_y)])
        except Exception as e:
            self.get_logger().warn(f"lay_seg failed: {e}")

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
        self.p_active.publish(String(data="robot_a"))
        self.p_goto.publish(Point(x=-0.6, y=0.07, z=0.78))

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
