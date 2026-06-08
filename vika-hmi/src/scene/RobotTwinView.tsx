/**
 * 3D digital-twin view of the robot.
 * Loads the real STL meshes from public/meshes/arm/ and assembles them along
 * the URDF joint chain (origins/rpy from base_only.urdf.xacro).
 *
 * URDF coordinate convention is Z-up; we wrap the whole robot in a -90° X
 * rotation to convert to three.js's Y-up. STL units are mm, scaled to m
 * via mesh.scale = 0.001.
 *
 * Joint angles j1..j6 are animated as a smooth idle motion.
 */
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Environment, Text } from '@react-three/drei';
import { ReactNode, Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { useRos } from '../ros/RosContext';

const ACCENT = '#fbbf24';

const MESH = {
  base: '/meshes/arm/base.stl',
  link1: '/meshes/arm/link1.stl',
  link2: '/meshes/arm/link2.stl',
  link3: '/meshes/arm/link3.stl',
  link4: '/meshes/arm/link4.stl',
  link5: '/meshes/arm/link5.stl',
  link6: '/meshes/arm/link6.stl',
  gripper: '/meshes/arm/gripper.stl',
};

// STL-Loader-Wrapper — mm → m via geometry scale.
// Children may be a render-fn receiving the bbox so decals can be placed on
// the actual mesh surface (the STL origin is usually NOT the geometric center).
function StlLink({
  url,
  color,
  metalness = 0.5,
  roughness = 0.45,
  children,
}: {
  url: string;
  color: string;
  metalness?: number;
  roughness?: number;
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

const BLACK = '#0c0d0f';
const BLACK_GLOSS = '#15171a';
const DARK = '#1a1c20';

// Robot URDF chain (joint origins copied verbatim from base_only.urdf.xacro)
function Robot() {
  const j1 = useRef<THREE.Group>(null!);
  const j2 = useRef<THREE.Group>(null!);
  const j3 = useRef<THREE.Group>(null!);
  const j4 = useRef<THREE.Group>(null!);
  const j5 = useRef<THREE.Group>(null!);
  const j6 = useRef<THREE.Group>(null!);

  const { jointsRef, connected } = useRos();

  useFrame((s) => {
    // When ROS is connected, mirror the live joint state. Otherwise idle-anim.
    if (connected) {
      const j = jointsRef.current;
      if (j1.current && j.j1 !== undefined) j1.current.rotation.z = j.j1;
      if (j2.current && j.j2 !== undefined) j2.current.rotation.z = j.j2;
      if (j3.current && j.j3 !== undefined) j3.current.rotation.z = j.j3;
      if (j4.current && j.j4 !== undefined) j4.current.rotation.z = j.j4;
      if (j5.current && j.j5 !== undefined) j5.current.rotation.z = j.j5;
      if (j6.current && j.j6 !== undefined) j6.current.rotation.z = j.j6;
      return;
    }
    const t = s.clock.elapsedTime;
    if (j1.current) j1.current.rotation.z = Math.sin(t * 0.25) * 0.6;
    if (j2.current) j2.current.rotation.z = Math.sin(t * 0.3 + 1.2) * 0.4;
    if (j3.current) j3.current.rotation.z = Math.sin(t * 0.35 + 2.0) * 0.5;
    if (j4.current) j4.current.rotation.z = Math.sin(t * 0.45 + 0.8) * 0.6;
    if (j5.current) j5.current.rotation.z = Math.sin(t * 0.5 + 1.7) * 0.7;
    if (j6.current) j6.current.rotation.z = t * 0.6;
  });

  // RPY in URDF → three.js Euler order 'ZYX' so R = Rz·Ry·Rx
  const E = (r: number, p: number, y: number) => new THREE.Euler(r, p, y, 'ZYX');

  return (
    // Z-up (URDF) → Y-up (three.js)
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* base_link at world origin */}
      <StlLink url={MESH.base} color={BLACK} />

      {/* j1: pos (0,0,0.175), rpy (0,0,1.5152), axis Z */}
      <group position={[0, 0, 0.175]} rotation={E(0, 0, 1.5152)}>
        <group ref={j1}>
          <StlLink url={MESH.link1} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />

          {/* j2: pos (0.1038,-0.4023,0.2912), rpy (π/2, 0, -π/2), axis Z */}
          <group position={[0.1038, -0.4023, 0.2912]} rotation={E(1.5708, 0, -1.5708)}>
            <group ref={j2}>
              <StlLink url={MESH.link2} color={BLACK_GLOSS} metalness={0.55} roughness={0.35}>
                {(bbox) => {
                  // Place the decal on the actual mesh surface — link2's STL
                  // origin is not at the geometric center, so we need the bbox
                  // to find the real ±Z faces.
                  const cx = (bbox.min.x + bbox.max.x) / 2;
                  const cy = (bbox.min.y + bbox.max.y) / 2;
                  const zFront = bbox.max.z - 0.028;
                  const zBack = bbox.min.z + 0.028;
                  return (
                    <>
                      <Text
                        position={[cx, cy, zFront]}
                        rotation={[0, 0, -Math.PI / 2]}
                        fontSize={0.18}
                        letterSpacing={0.02}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.004}
                        outlineColor="#000000"
                        material-toneMapped={false}
                      >
                        V.I.K.A
                      </Text>
                      <Text
                        position={[cx, cy, zBack]}
                        rotation={[0, Math.PI, -Math.PI / 2]}
                        fontSize={0.18}
                        letterSpacing={0.02}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.004}
                        outlineColor="#000000"
                        material-toneMapped={false}
                      >
                        V.I.K.A
                      </Text>
                    </>
                  );
                }}
              </StlLink>

              {/* j3: pos (0,1.300,0), rpy (0,0,-0.2221), axis Z */}
              <group position={[0, 1.3, 0]} rotation={E(0, 0, -0.2221)}>
                <group ref={j3}>
                  <StlLink url={MESH.link3} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />

                  {/* j4: pos (0.1600, 0.2369, 0.0003), rpy (1.5708, 0.9923, 1.5708) */}
                  <group
                    position={[0.16, 0.2369, 0.0003]}
                    rotation={E(1.5708, 0.9923, 1.5708)}
                  >
                    <group ref={j4}>
                      <StlLink url={MESH.link4} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />

                      {/* j5: pos (-0.0860, 0, 1.3050), rpy (1.5708, -1.3556, -1.5708) */}
                      <group
                        position={[-0.086, 0, 1.305]}
                        rotation={E(1.5708, -1.3556, -1.5708)}
                      >
                        <group ref={j5}>
                          <StlLink url={MESH.link5} color={BLACK_GLOSS} metalness={0.55} roughness={0.35} />

                          {/* j6: pos (0.1600, 0, -0.0850), rpy (-1.5708, 1.3440, -1.5708) */}
                          <group
                            position={[0.16, 0, -0.085]}
                            rotation={E(-1.5708, 1.344, -1.5708)}
                          >
                            <group ref={j6}>
                              <StlLink url={MESH.link6} color={BLACK_GLOSS} metalness={0.6} roughness={0.3} />

                              {/* tool0 → gripper: pos (0,0,0.020), rpy (-π, 0, -0.7298) */}
                              <group
                                position={[0, 0, 0.02]}
                                rotation={E(-3.1416, 0, -0.7298)}
                              >
                                <StlLink url={MESH.gripper} color={DARK} metalness={0.7} roughness={0.4} />
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

function PalletAndBricks() {
  const bricks = [
    [1.3, 0.05, -0.3],
    [1.3, 0.05, 0.0],
    [1.3, 0.05, 0.3],
    [1.55, 0.05, -0.15],
    [1.55, 0.05, 0.15],
  ] as const;
  return (
    <group>
      <mesh position={[1.4, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.04, 0.8]} />
        <meshStandardMaterial color="#5a4a32" roughness={0.9} />
      </mesh>
      {bricks.map((p, i) => (
        <mesh key={i} position={p as unknown as [number, number, number]} castShadow>
          <boxGeometry args={[0.21, 0.06, 0.1]} />
          <meshStandardMaterial color="#a04030" roughness={0.85} />
        </mesh>
      ))}
    </group>
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

export function RobotTwinView() {
  return (
    <Canvas shadows camera={{ position: [3.5, 2.6, 3.5], fov: 45 }} gl={{ antialias: true }}>
      <color attach="background" args={['#1a1d21']} />
      <fog attach="fog" args={['#1a1d21', 10, 28]} />

      <ambientLight intensity={0.18} />
      {/* Soft fill from one side so the black robot keeps definition */}
      <directionalLight position={[-3, 4, -2]} intensity={0.25} color={ACCENT} />

      {/* Hero spotlight on the robot */}
      <spotLight
        position={[2.5, 7, 2.5]}
        angle={0.45}
        penumbra={0.55}
        intensity={70}
        distance={20}
        decay={1.6}
        color="#ffffff"
        target-position={[0, 1.0, 0]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />

      <Environment preset="warehouse" environmentIntensity={0.35} />

      {/* Gray floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#3a3f46" roughness={0.85} metalness={0.05} />
      </mesh>

      <Grid
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#2a323d"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor={ACCENT}
        fadeDistance={18}
        fadeStrength={1.5}
        infiniteGrid
        position={[0, 0.002, 0]}
      />

      <ContactShadows position={[0, 0.005, 0]} opacity={0.55} blur={2} scale={8} far={3} />

      <Suspense fallback={<LoadingFallback />}>
        <Robot />
      </Suspense>
      <PalletAndBricks />

      <OrbitControls
        target={[0, 1.0, 0]}
        minDistance={1.5}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
