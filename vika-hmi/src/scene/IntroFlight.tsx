import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SITE_ECEF, SITE_UP } from './geo';

// Google-Earth-Style Zoom: Kamera startet im Weltall (radial vom Site-Anker nach außen),
// fliegt mit Ease-out-Cubic auf eine schräge Site-View. Läuft genau einmal beim Mount.
//
// Distanzen entlang der ECEF-Up-Achse (Site-Normale):
//   START_ALT  — knapp außerhalb LEO, Erdkrümmung sichtbar
//   END_ALT    — Schrägflug-Hover über der Baustelle
const START_ALT = 8_000_000; // 8 000 km — fast halber Erdumfang Sicht
const END_ALT = 600;         // 600 m — Hubschrauber-Perspektive
const TILT_DEG = 55;         // End-Kamera-Neigung relativ zur Lotrechten
const DURATION_S = 7.0;      // Dauer der Anflug-Animation

// Cubic-Ease-out — schneller Start, sanftes Landen (klassischer Earth-Zoom)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function IntroFlight({
  onComplete,
  enabled = true,
}: {
  onComplete?: () => void;
  enabled?: boolean;
}) {
  const { camera } = useThree();
  const startTime = useRef<number | null>(null);
  const done = useRef(false);

  // Tangenten-Basis am Site (Ost / Nord / Up) für die End-Position berechnen
  const basis = useRef(buildLocalBasis(SITE_UP));

  // End-Pose vorab: ECEF + Up*end_alt, plus seitlicher Offset, schräg auf Site blickend
  const endPos = useRef(
    SITE_ECEF.clone()
      .add(SITE_UP.clone().multiplyScalar(END_ALT * Math.cos(THREE.MathUtils.degToRad(TILT_DEG))))
      .add(basis.current.east.clone().multiplyScalar(END_ALT * Math.sin(THREE.MathUtils.degToRad(TILT_DEG)) * 0.6))
      .add(basis.current.north.clone().multiplyScalar(-END_ALT * Math.sin(THREE.MathUtils.degToRad(TILT_DEG)) * 0.8)),
  );

  // Start-Pose: weit oben entlang Site-Up
  const startPos = useRef(SITE_ECEF.clone().add(SITE_UP.clone().multiplyScalar(START_ALT)));

  useEffect(() => {
    if (!enabled) return;
    camera.position.copy(startPos.current);
    camera.up.copy(basis.current.north); // Norden ist "oben" auf dem Bildschirm
    camera.lookAt(SITE_ECEF);
    camera.near = 1;
    camera.far = 50_000_000;
    camera.updateProjectionMatrix();
  }, [camera, enabled]);

  useFrame((_, delta) => {
    if (!enabled || done.current) return;
    if (startTime.current === null) startTime.current = 0;
    startTime.current += delta;

    const t = Math.min(startTime.current / DURATION_S, 1);
    const k = easeOut(t);

    // Position lerp in Log-Space — sonst sieht der lineare Lerp im All schleichend langsam aus
    const logStart = Math.log(START_ALT);
    const logEnd = Math.log(END_ALT);
    const altNow = Math.exp(THREE.MathUtils.lerp(logStart, logEnd, k));

    const radial = SITE_UP.clone().multiplyScalar(altNow);
    const sideMix = k; // seitlicher Offset wächst gegen Ende → schöner Schrägflug
    const offset = endPos.current.clone().sub(SITE_ECEF).sub(SITE_UP.clone().multiplyScalar(END_ALT));
    const pos = SITE_ECEF.clone().add(radial).add(offset.multiplyScalar(sideMix * (END_ALT / altNow)));

    camera.position.copy(pos);
    camera.up.copy(basis.current.north);
    camera.lookAt(SITE_ECEF);

    if (t >= 1) {
      done.current = true;
      onComplete?.();
    }
  });

  return null;
}

function buildLocalBasis(up: THREE.Vector3) {
  // East = z-axis × up, North = up × east — Standard ENU-Frame in ECEF
  const east = new THREE.Vector3(0, 0, 1).cross(up).normalize();
  const north = up.clone().cross(east).normalize();
  return { east, north, up: up.clone() };
}
