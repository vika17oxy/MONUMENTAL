import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';

// Digital twin placeholder. Phase 6/7: load URDF via urdf-loader and bind to /joint_states.
export function TwinScene() {
  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Grid args={[20, 20]} cellColor="#444" sectionColor="#666" infiniteGrid />
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.2, 0.4, 0.8]} />
        <meshStandardMaterial color="#e6b800" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}
