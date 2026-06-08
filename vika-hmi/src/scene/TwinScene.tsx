import { Canvas } from '@react-three/fiber';
import { MapControls, Grid } from '@react-three/drei';
import { useState } from 'react';
import { GoogleTilesGround, FallbackGround, GOOGLE_TILES_ENABLED, GOOGLE_TILES_ATTRIBUTION } from './GoogleTilesGround';
import { IntroFlight } from './IntroFlight';
import { SITE_ECEF } from './geo';

export function TwinScene() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      <Canvas
        camera={{ fov: 55, near: 1, far: 50_000_000, position: [3, 3, 3] }}
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[1, 2, 1]} intensity={1.0} />

        {GOOGLE_TILES_ENABLED ? <GoogleTilesGround errorTarget={16} /> : <FallbackGround />}

        <IntroFlight enabled={GOOGLE_TILES_ENABLED} onComplete={() => setIntroDone(true)} />

        {/* Robot-Twin Platzhalter — sitzt am Site-Anker, wird in Phase 6 durch URDF ersetzt */}
        <group position={SITE_ECEF.toArray()}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[1.2, 0.4, 0.8]} />
            <meshStandardMaterial color="#e6b800" />
          </mesh>
        </group>

        {/* Grid + Orbit erst NACH dem Intro freigeben — sonst zerren OrbitControls am Animations-Frame */}
        {introDone && (
          <>
            <Grid
              args={[40, 40]}
              cellColor="#444"
              sectionColor="#666"
              position={SITE_ECEF.toArray()}
              fadeDistance={50}
            />
            <MapControls
              target={SITE_ECEF.toArray()}
              minDistance={5}
              maxDistance={20000}
              enableDamping
              dampingFactor={0.1}
              screenSpacePanning={false}
            />
          </>
        )}
      </Canvas>

      {GOOGLE_TILES_ENABLED && (
        <div className="pointer-events-none absolute bottom-2 right-3 z-10 text-[9px] uppercase tracking-[0.2em] text-white/50">
          {GOOGLE_TILES_ATTRIBUTION}
        </div>
      )}
    </>
  );
}
