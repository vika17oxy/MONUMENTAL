import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TilesRenderer } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';
import * as THREE from 'three';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Photorealistic 3D Tiles via Google Map Tiles API.
// Caching erfolgt über den eingebauten LRU-Cache (max ~30 Tage app-intern, ToS-konform).
// errorTarget steuert Detailgrad: höher = weniger Tiles geladen = weniger Free-Tier-Verbrauch.
export function GoogleTilesGround({ errorTarget = 16 }: { errorTarget?: number }) {
  const { scene, camera, gl } = useThree();
  const tilesRef = useRef<TilesRenderer | null>(null);

  useEffect(() => {
    if (!API_KEY) {
      console.warn('[GoogleTilesGround] VITE_GOOGLE_MAPS_API_KEY fehlt — Tiles deaktiviert.');
      return;
    }

    const tiles = new TilesRenderer('https://tile.googleapis.com/v1/3dtiles/root.json');
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: API_KEY, autoRefreshToken: true }));
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, gl);
    tiles.errorTarget = errorTarget;

    scene.add(tiles.group);
    tilesRef.current = tiles;

    return () => {
      scene.remove(tiles.group);
      tiles.dispose();
      tilesRef.current = null;
    };
  }, [scene, camera, gl, errorTarget]);

  useFrame(() => {
    const t = tilesRef.current;
    if (!t) return;
    t.setCamera(camera);
    t.setResolutionFromRenderer(camera, gl);
    camera.updateMatrixWorld();
    t.update();
  });

  // Attribution-Pflicht laut Maps Platform ToS — DOM-Element wird in App.tsx gerendert,
  // hier nur ein Marker damit es nicht vergessen wird.
  return null;
}

export const GOOGLE_TILES_ATTRIBUTION = 'Imagery © Google';

// Cleaner Three.js-Fallback-Boden, falls kein API-Key gesetzt
export function FallbackGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#1a1a1a" />
    </mesh>
  );
}

export const GOOGLE_TILES_ENABLED = !!API_KEY;
