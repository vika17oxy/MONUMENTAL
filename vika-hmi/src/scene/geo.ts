import * as THREE from 'three';

// Technikum Wien (Höchstädtplatz 6, 1200 Wien) — GPS-Anker für die Baustellen-Zelle
export const SITE_LAT = 48.23974;
export const SITE_LON = 16.37787;
export const SITE_ALT = 160; // m über Ellipsoid (Boden-Niveau ungefähr)

// WGS84 → ECEF (meter, geozentrisch). 3d-tiles-renderer liefert Tiles in ECEF;
// wir spiegeln das Anker-System hier, um Kamera/Lights in derselben Welt zu setzen.
const WGS84_A = 6378137.0;
const WGS84_B = 6356752.3142;
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);

export function latLonAltToEcef(latDeg: number, lonDeg: number, altM: number): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const sinLat = Math.sin(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const x = (N + altM) * Math.cos(lat) * Math.cos(lon);
  const y = (N + altM) * Math.cos(lat) * Math.sin(lon);
  const z = (N * (1 - WGS84_E2) + altM) * sinLat;
  return new THREE.Vector3(x, y, z);
}

// "Up"-Vektor an einer Lat/Lon-Position (ECEF-Normale)
export function ecefUp(latDeg: number, lonDeg: number): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ).normalize();
}

export const SITE_ECEF = latLonAltToEcef(SITE_LAT, SITE_LON, SITE_ALT);
export const SITE_UP = ecefUp(SITE_LAT, SITE_LON);
