/**
 * 3D digital-twin of the WHOLE cell — both robots (live from their joint_states
 * over rosbridge), the two linear rails, the pallet and the brick row.
 *
 * STL meshes are assembled along the URDF joint chain (origins from the xacro).
 * URDF is Z-up; each robot is wrapped in a -90° X rotation to convert to
 * three.js Y-up. World layout mapping used here (Z-up world -> three.js Y-up):
 *   three.js X = world X,  three.js Y = world Z (up),  three.js Z = -world Y.
 */
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Environment, Text, Line, Html, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import ROSLIB from 'roslib';
import { useRos } from '../ros/RosContext';

// ── Satellite ground (ESRI World Imagery) — the construction site under the robots
const SITE = { lat: 48.23986680047265, lon: 16.377095507156092 };
const SAT_Z = 20;          // tile zoom (max ESRI detail ≈ 0.1 m/px)
const SAT_N = 3;           // n×n tile mosaic
const ESRI = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const lon2tileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const lat2tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const metersPerPixel = (z: number, lat: number) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

/** Build a CanvasTexture from an n×n ESRI tile mosaic centred on the site, plus
 *  the world-metre offset that puts the site at the scene origin. */
function useSatelliteGround() {
  const [data, setData] = useState<{ tex: THREE.Texture; size: number; ox: number; oz: number } | null>(null);
  useEffect(() => {
    const z = SAT_Z, n = SAT_N;
    const cx = lon2tileX(SITE.lon, z), cy = lat2tileY(SITE.lat, z);
    const x0 = Math.floor(cx) - Math.floor(n / 2), y0 = Math.floor(cy) - Math.floor(n / 2);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n * 256;
    const ctx = canvas.getContext('2d')!;
    let loaded = 0;
    const finish = () => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const mpp = metersPerPixel(z, SITE.lat);
      const size = n * 256 * mpp;
      // site pixel within the canvas → world offset so the site sits at origin
      const sitePxX = (cx - x0) * 256, sitePxY = (cy - y0) * 256;
      const ox = (n * 128 - sitePxX) * mpp;
      const oz = (sitePxY - n * 128) * mpp;
      setData({ tex, size, ox, oz });
    };
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { ctx.drawImage(img, i * 256, k * 256); if (++loaded === n * n) finish(); };
      img.onerror = () => { if (++loaded === n * n) finish(); };
      img.src = ESRI(z, x0 + i, y0 + k);
    }
  }, []);
  return data;
}

const ACCENT = '#fbbf24';
const BLACK = '#0c0d0f';
const BLACK_GLOSS = '#15171a';
const RAIL_GREY = '#40404a';      // URDF rail_grey
const CARRIAGE = '#2e2e34';       // URDF carriage_dark
const CEMENT_RED = '#b3261a';     // URDF tool_red

// World layout baked into the URDF (see base_rail.xacro / full_demo.launch.py):
//   robot_a (VIKA-6, gripper) base_x=-2.0  yaw=0      robot_b (VIKA-5, cement) base_x=+0.8 yaw=π
// Rail beam: 0.25×12.5×0.12 box centred at world (base_x, +4, 0.15); carriage
// 0.9×0.9×0.18 at world z=0.30; arm mounts at world z=0.39.  (world z -> three.js y)
const RAIL_LEN = 12.5;
const RAIL_CZ = -4;               // three.js z = -world y(+4)
const BASE_Y = 0.39;              // arm base height (carriage top)

const MESH = {
  base: '/meshes/arm/base.stl', link1: '/meshes/arm/link1.stl', link2: '/meshes/arm/link2.stl',
  link3: '/meshes/arm/link3.stl', link4: '/meshes/arm/link4.stl', link5: '/meshes/arm/link5.stl',
  link6: '/meshes/arm/link6.stl', gripper: '/meshes/arm/gripper.stl',
};

type JMap = Record<string, number>;

/** Subscribe to one robot's /joint_states; returns a live-updating ref. */
function useRobotJoints(id: 'robot_a' | 'robot_b') {
  const { ros } = useRos();
  const ref = useRef<JMap>({});
  useEffect(() => {
    if (!ros) return;
    const t = new ROSLIB.Topic({
      ros, name: `/${id}/joint_states`, messageType: 'sensor_msgs/JointState', throttle_rate: 33,
    });
    t.subscribe((m: any) => {
      const names: string[] = m.name ?? [], pos: number[] = m.position ?? [];
      for (let i = 0; i < names.length; i++) ref.current[names[i]] = pos[i];
    });
    return () => t.unsubscribe();
  }, [ros, id]);
  return ref;
}

function StlLink({ url, color, metalness = 0.5, roughness = 0.45, children }: {
  url: string; color: string; metalness?: number; roughness?: number;
  children?: ReactNode | ((bbox: THREE.Box3) => ReactNode);
}) {
  const raw = useLoader(STLLoader, url);
  const geom = useMemo(() => {
    const g = raw.clone();
    g.scale(0.001, 0.001, 0.001);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  }, [raw]);
  return (
    <group>
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      </mesh>
      {typeof children === 'function' ? children(geom.boundingBox!) : children}
    </group>
  );
}

const E = (r: number, p: number, y: number) => new THREE.Euler(r, p, y, 'ZYX');

/** Cement nozzle tool (VIKA-5) — red base + thin nozzle (tool_cement.xacro).
 *  Mounted in the tool0 frame; the tool extends along tool0 +Z toward the work. */
function CementTool() {
  return (
    <group>
      {/* cement_base: cyl r0.04 l0.08, centre z=0.08 from tool0 */}
      <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 24]} />
        <meshStandardMaterial color={CEMENT_RED} metalness={0.25} roughness={0.6} />
      </mesh>
      {/* nozzle: cyl r0.015 l0.08, centre z=0.16 */}
      <mesh position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.08, 16]} />
        <meshStandardMaterial color={CEMENT_RED} metalness={0.25} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** Vacuum suction gripper (VIKA-6) — wide bar + 3 round pads, one per brick
 *  (tool_gripper.xacro). Mounted in the tool0 frame; pads face tool0 +Z. */
function GripperTool() {
  return (
    <group>
      {/* mounting bar: 0.34(X) × 0.95(Y) × 0.04(Z), centre z=0.04 from tool0 */}
      <mesh position={[0, 0, 0.04]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.95, 0.04]} />
        <meshStandardMaterial color="#66666f" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* 3 suction pads: cyl r0.09 l0.04 along Z, at y = 0, ±0.375, z=0.08 */}
      {[-0.375, 0, 0.375].map((y) => (
        <mesh key={y} position={[0, y, 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.04, 28]} />
          <meshStandardMaterial color="#1f1f24" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** One robot — URDF chain driven live 1:1 from `/${id}/joint_states` (rail slide
 *  + 6 arm joints). No data → holds the rest pose (no idle animation). */
function Robot({ id, joints, baseX, yaw = 0, tool = 'gripper', decal = true }: {
  id: 'robot_a' | 'robot_b'; joints: React.MutableRefObject<JMap>; baseX: number;
  yaw?: number; tool?: 'gripper' | 'cement'; decal?: boolean;
}) {
  const slide = useRef<THREE.Group>(null!);
  const j1 = useRef<THREE.Group>(null!), j2 = useRef<THREE.Group>(null!), j3 = useRef<THREE.Group>(null!);
  const j4 = useRef<THREE.Group>(null!), j5 = useRef<THREE.Group>(null!), j6 = useRef<THREE.Group>(null!);

  useFrame(() => {
    const j = joints.current;
    // rail slide: world +Y travel = cos(yaw)*rail → three.js z = −worldY
    const rail = j[`${id}_rail_joint`];
    if (slide.current && rail !== undefined) slide.current.position.z = -Math.cos(yaw) * rail;
    const g = (n: number) => j[`${id}_arm_j${n}`];
    if (g(1) === undefined) return;              // no data yet → keep rest pose
    if (j1.current) j1.current.rotation.z = g(1);
    if (j2.current) j2.current.rotation.z = g(2);
    if (j3.current) j3.current.rotation.z = g(3);
    if (j4.current) j4.current.rotation.z = g(4);
    if (j5.current) j5.current.rotation.z = g(5);
    if (j6.current) j6.current.rotation.z = g(6);
  });

  return (
    <group ref={slide} position={[baseX, 0, 0]}>
      <Carriage x={0} />
      <group position={[0, BASE_Y, 0]} rotation={[0, yaw, 0]}>
       <group rotation={[-Math.PI / 2, 0, 0]}>
      <StlLink url={MESH.base} color={BLACK} />
      <group position={[0, 0, 0.175]} rotation={E(0, 0, 1.5152)}>
        <group ref={j1}>
          <StlLink url={MESH.link1} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />
          <group position={[0.1038, -0.4023, 0.2912]} rotation={E(1.5708, 0, -1.5708)}>
            <group ref={j2}>
              <StlLink url={MESH.link2} color={BLACK_GLOSS} metalness={0.55} roughness={0.35}>
                {(bbox) => {
                  if (!decal) return null;
                  const cx = (bbox.min.x + bbox.max.x) / 2, cy = (bbox.min.y + bbox.max.y) / 2;
                  return (
                    <>
                      <Text position={[cx, cy, bbox.max.z - 0.028]} rotation={[0, 0, -Math.PI / 2]} fontSize={0.18}
                        color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.004} outlineColor="#000" material-toneMapped={false}>V.I.K.A</Text>
                      <Text position={[cx, cy, bbox.min.z + 0.028]} rotation={[0, Math.PI, -Math.PI / 2]} fontSize={0.18}
                        color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.004} outlineColor="#000" material-toneMapped={false}>V.I.K.A</Text>
                    </>
                  );
                }}
              </StlLink>
              <group position={[0, 1.3, 0]} rotation={E(0, 0, -0.2221)}>
                <group ref={j3}>
                  <StlLink url={MESH.link3} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />
                  <group position={[0.16, 0.2369, 0.0003]} rotation={E(1.5708, 0.9923, 1.5708)}>
                    <group ref={j4}>
                      <StlLink url={MESH.link4} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />
                      <group position={[-0.086, 0, 1.305]} rotation={E(1.5708, -1.3556, -1.5708)}>
                        <group ref={j5}>
                          <StlLink url={MESH.link5} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />
                          <group position={[0.16, 0, -0.085]} rotation={E(-1.5708, 1.344, -1.5708)}>
                            <group ref={j6}>
                              <StlLink url={MESH.link6} color={BLACK_GLOSS} metalness={0.6} roughness={0.3} />
                              {/* URDF tools mount at tool0 (= this j6 frame) with no
                                  extra rotation — the old gripper.stl needed one. */}
                              {tool === 'cement' ? <CementTool /> : <GripperTool />}
                            </group>
                          </group>
                        </group>
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
       </group>
       </group>
      </group>
  );
}

/** A linear rail beam (URDF base_rail): 0.25×0.12×12.5 grey box along world +Y
 *  (three.js −Z), centred at world y=+4.  Carriage block rides on top. */
function Rail({ x }: { x: number }) {
  return (
    <mesh position={[x, 0.15, RAIL_CZ]} castShadow receiveShadow>
      <boxGeometry args={[0.25, 0.12, RAIL_LEN]} />
      <meshStandardMaterial color={RAIL_GREY} metalness={0.35} roughness={0.65} />
    </mesh>
  );
}

/** The prismatic carriage (base_link): 0.9×0.18×0.9 dark slider, top at world
 *  z=0.39 so the arm base sits squarely on it. */
function Carriage({ x, z = 0 }: { x: number; z?: number }) {
  return (
    <mesh position={[x, 0.30, z]} castShadow receiveShadow>
      <boxGeometry args={[0.9, 0.18, 0.9]} />
      <meshStandardMaterial color={CARRIAGE} metalness={0.4} roughness={0.55} />
    </mesh>
  );
}

/** Euro pallet + the pick bricks at the real sim world positions
 *  (construction_site.sdf): 3 rows along Y × 3 bricks along X, a SINGLE flat layer
 *  (row_0_0 dynamic pick-row + row_1_0/row_2_0 static deco), all at z base 0.144.
 *  world (x, y) -> three.js (x, -y); world z (up) -> three.js y. */
function PalletAndBricks() {
  const RY = [0.04, 0.30, 0.56];          // 3 rows along world Y
  const RX = [-0.985, -0.6, -0.215];      // 3 bricks per row along world X (centre -0.6 ± 0.385)
  const BH = 0.238, BASE_Z = 0.144;       // brick height; pallet top = first-layer base
  const cy = BASE_Z + BH / 2;             // single-layer brick centre (world z)
  const bricks: ReactNode[] = [];
  RY.forEach((wy, yi) =>
    RX.forEach((wx, xi) => {
      bricks.push(
        // visual-only gap: render each brick a bit smaller than its real footprint
        // (0.375 × 0.25) so the bricks read as separate; centres = real sim positions.
        <mesh key={`${yi}-${xi}`} position={[wx, cy, -wy]} castShadow receiveShadow>
          <boxGeometry args={[0.32, BH, 0.20]} />
          <meshStandardMaterial color="#e0331e" roughness={0.85} />
        </mesh>,
      );
    }),
  );
  return (
    <group>
      {/* euro pallet (1.2 × 0.8 × 0.144), top at world z=0.144, centred under the stack */}
      <mesh position={[-0.6, 0.072, -0.30]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.144, 0.8]} />
        <meshStandardMaterial color="#7a5a34" roughness={0.9} />
      </mesh>
      {bricks}
    </group>
  );
}

/** The wall built so far — placed static bricks mirrored live from the BT
 *  (/wall/state). Each brick is yawed so its long side (0.375) runs along world Y.
 *  world (x,y,z) -> three.js (x, z, -y). */
function WallBricks({ bricks }: { bricks: [number, number, number][] }) {
  if (!bricks.length) return null;
  return (
    <group>
      {bricks.map(([wx, wy, wz], i) => (
        <mesh key={i} position={[wx, wz, -wy]} castShadow receiveShadow>
          <boxGeometry args={[0.25, 0.238, 0.375]} />
          <meshStandardMaterial color="#b83227" roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

function Cell() {
  const ja = useRobotJoints('robot_a');
  const jb = useRobotJoints('robot_b');
  const { wallBricks } = useRos();
  return (
    <group>
      {/* world layout from the URDF: rail_a x=-2 (yaw 0), rail_b x=+0.8 (yaw π).
          Each Robot carries its own carriage and slides along its rail live. */}
      <Rail x={-2} />
      <Rail x={0.8} />
      <Robot id="robot_a" joints={ja} baseX={-2} yaw={0} tool="gripper" />
      <Robot id="robot_b" joints={jb} baseX={0.8} yaw={Math.PI} tool="cement" decal={false} />
      <PalletAndBricks />
      <WallBricks bricks={wallBricks} />
    </group>
  );
}

/** Satellite-imagery ground plane (ESRI), centred so the site is at the origin. */
function SatelliteGround() {
  const sat = useSatelliteGround();
  if (!sat) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#3a3f46" roughness={0.85} metalness={0.05} />
      </mesh>
    );
  }
  return (
    <>
      {/* large dim base so the world extends beyond the imagery */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2b2f35" roughness={0.95} />
      </mesh>
      {/* the satellite tile mosaic */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sat.ox, 0, sat.oz]} receiveShadow>
        <planeGeometry args={[sat.size, sat.size]} />
        <meshStandardMaterial map={sat.tex} roughness={0.95} metalness={0} />
      </mesh>
    </>
  );
}

function LoadingFallback() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <meshStandardMaterial color={ACCENT} wireframe />
    </mesh>
  );
}

// Wall planner geometry — the wall is fixed: it starts where the auto-flow lays
// the first brick (world x=-0.6, y=2.0) and runs straight along +Y. Only its
// LENGTH is drawn → a brick count (1..MAX_BRICKS). world (x,y) -> three.js (x,-y).
const WALL_START_X = -0.6;
const WALL_START_Y = 2.0;
const BRICK_LEN = 0.375;          // brick long side, along the +Y wall
const MAX_BRICKS = 5;
const SX = WALL_START_X;          // three.js x
const SZ = -WALL_START_Y;         // three.js z (= -world y)

/** The wall plan: fixed start anchor + a straight +Y line of `count` bricks, with
 *  the count hovering over the line. Direction is locked (no angle change). */
function WallPlan({ count }: { count: number }) {
  if (count <= 0) return null;
  const endZ = SZ - count * BRICK_LEN;                 // +Y world = -Z three.js
  return (
    <group>
      {/* start anchor (where the first brick goes) */}
      <mesh position={[SX, 0.06, SZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.11, 0.2, 28]} />
        <meshBasicMaterial color={ACCENT} side={THREE.DoubleSide} />
      </mesh>
      {/* the straight wall line */}
      <Line points={[[SX, 0.06, SZ], [SX, 0.06, endZ]]} color={ACCENT} lineWidth={4} />
      {/* per-brick separators */}
      {Array.from({ length: count + 1 }, (_, i) => (
        <mesh key={i} position={[SX, 0.06, SZ - i * BRICK_LEN]}>
          <sphereGeometry args={[0.055, 12, 12]} />
          <meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* count hovering over the line (billboard, always faces the camera) */}
      <Html position={[SX, 0.5, (SZ + endZ) / 2]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap',
          padding: '2px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.7)',
          border: `1px solid ${ACCENT}`, color: ACCENT, fontFamily: 'monospace',
          fontWeight: 700, transform: 'translateY(-50%)',
        }}>
          <span style={{ fontSize: 18 }}>{count}</span>
          <span style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
            {count === 1 ? 'brick' : 'bricks'}
          </span>
        </div>
      </Html>
    </group>
  );
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
// brick-centre world points for the BT: [x, y] along +Y from the start
const wallPoints = (count: number): [number, number][] =>
  Array.from({ length: count }, (_, i) => [r3(WALL_START_X), r3(WALL_START_Y + i * BRICK_LEN)]);
// pointer ground point -> clamped brick count along the fixed +Y axis
const countFromPoint = (pz: number) =>
  Math.min(MAX_BRICKS, Math.max(1, Math.round(Math.max(0, SZ - pz) / BRICK_LEN)));

/** Combined site view: satellite ground + live 3D robots, with a 2D/3D camera
 *  toggle, zoom (orbit), and a draw-a-line wall planner that publishes /hmi/wall. */
export function RobotTwinView() {
  const { sendWall } = useRos();
  const [mode2d, setMode2d] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [count, setCount] = useState(0);          // planned wall length in bricks (0 = none)

  const toggleDraw = () => setDrawing((d) => { const nd = !d; if (nd && count === 0) setCount(1); return nd; });
  const clearWall = () => { setCount(0); setDrawing(false); sendWall([]); };
  const commitWall = () => { if (count > 0) { sendWall(wallPoints(count)); setDrawing(false); } };

  return (
    <div className="relative h-full w-full">
      <Canvas shadows gl={{ antialias: true }}>
        <color attach="background" args={['#1a1d21']} />
        <fog attach="fog" args={['#1a1d21', 16, 70]} />
        {mode2d
          ? <OrthographicCamera makeDefault position={[0, 40, 0.01]} zoom={42} near={0.1} far={200} />
          : <PerspectiveCamera makeDefault position={[4.5, 3.4, 5.2]} fov={42} near={0.1} far={200} />}
        <ambientLight intensity={mode2d ? 0.55 : 0.2} />
        <directionalLight position={[-3, 4, -2]} intensity={0.25} color={ACCENT} />
        <spotLight position={[2.5, 8, 3]} angle={0.6} penumbra={0.55} intensity={90} distance={26} decay={1.5}
          color="#ffffff" target-position={[0, 0.6, 0]} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0005} />
        <Environment preset="warehouse" environmentIntensity={0.35} />

        <Suspense fallback={null}><SatelliteGround /></Suspense>
        <Grid args={[40, 40]} cellSize={1} cellThickness={0.5} cellColor="#ffffff"
          sectionSize={5} sectionThickness={0.8} sectionColor={ACCENT} fadeDistance={mode2d ? 60 : 20} fadeStrength={2}
          infiniteGrid position={[0, 0.004, 0]} />
        <ContactShadows position={[0, 0.006, 0]} opacity={0.45} blur={2} scale={12} far={3} />

        <Suspense fallback={<LoadingFallback />}><Cell /></Suspense>
        <WallPlan count={count} />

        {/* draw catcher (only while drawing): pointer position sets the wall LENGTH
            (brick count) along the fixed +Y axis; a click commits the plan. The
            angle never changes — only e.point.z (the +Y distance) is used. */}
        {drawing && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}
            onPointerMove={(e) => { e.stopPropagation(); setCount(countFromPoint(e.point.z)); }}
            onClick={(e) => { e.stopPropagation(); commitWall(); }}>
            <planeGeometry args={[200, 200]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        <OrbitControls target={[0, mode2d ? 0 : 0.8, 0]} minDistance={2} maxDistance={mode2d ? 90 : 20}
          enableRotate={!mode2d} maxPolarAngle={Math.PI / 2 - 0.05} enableDamping dampingFactor={0.08} />
      </Canvas>

      {/* overlay controls */}
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button onClick={() => setMode2d((v) => !v)} className="btn px-3 py-1.5 text-[11px]">{mode2d ? '◆ 3D' : '◰ 2D'}</button>
        <button onClick={toggleDraw} className={`btn px-3 py-1.5 text-[11px] ${drawing ? 'btn-primary' : ''}`}>✎ Wall</button>
        <button onClick={commitWall} disabled={count < 1} className="btn px-3 py-1.5 text-[11px] disabled:opacity-30">✓ Plan</button>
        <button onClick={clearWall} disabled={!count} className="btn btn-danger px-2 py-1.5 text-[11px] disabled:opacity-30">✕</button>
      </div>
      {drawing && (
        <div className="absolute bottom-3 left-3 z-10 rounded-sm bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider text-accent">
          move along the line to set length · {count}/{MAX_BRICKS} bricks · click to place
        </div>
      )}
    </div>
  );
}
