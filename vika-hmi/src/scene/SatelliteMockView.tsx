/**
 * Site view: ESRI World Imagery, served as XYZ tile mosaic.
 * Features:
 *  - Slippy-map style: drag-pans tiles in DOM, no per-pan refetch
 *  - Tiles cached by the browser per URL (z/y/x) → re-entering a region = instant
 *  - Wheel + slider zoom (cursor-centered)
 *  - Optional 1 m / 5 m grid overlay (rendered in screen-space, recomputed per zoom)
 *  - Click-to-draw wall vertices in world coords (lat/lon) — survive pan/zoom
 *  - Recenter on Höchstädtplatz
 *
 * Tiles can be served offline by placing files at:
 *   public/tiles/{z}/{y}/{x}.jpg
 * The component prefers local tiles and falls back to ESRI when missing
 * (browser handles fallback via <img onError>).
 */
import { useEffect, useMemo, useRef, useState } from 'react';

const SITE = {
  lat: 48.23986680047265,
  lon: 16.377095507156092,
  label: 'Höchstädtplatz, Wien',
};

const TILE_SIZE = 256;
const Z_MIN = 14;
const Z_MAX = 20;
const Z_DEFAULT = 18;

const ESRI = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

// ── Web Mercator tile math ──────────────────────────────────────────────
const lon2tileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const lat2tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const tileX2lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tileY2lat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

// Meters per pixel at given zoom and latitude (Web Mercator)
const metersPerPixel = (z: number, lat: number) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

type LL = { lat: number; lon: number };

export function SatelliteMockView() {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [center, setCenter] = useState<LL>({ lat: SITE.lat, lon: SITE.lon });
  const [zoom, setZoom] = useState(Z_DEFAULT);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  const [gridOn, setGridOn] = useState(true);
  const [snap, setSnap] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [pts, setPts] = useState<LL[]>([]);

  // Drag-to-pan: shifted via CSS transform; commit to center on release
  const [panPx, setPanPx] = useState({ dx: 0, dy: 0 });
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // ── Track viewport size ────────────────────────────────────────────────
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.current!.getBoundingClientRect();
      setVp({ w: r.width, h: r.height });
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  // ── Center → fractional tile coords ────────────────────────────────────
  const cTileX = lon2tileX(center.lon, zoom);
  const cTileY = lat2tileY(center.lat, zoom);

  // ── Visible tile range (with 1-tile buffer around viewport) ────────────
  const tileRange = useMemo(() => {
    if (vp.w === 0 || vp.h === 0) return null;
    const halfW = vp.w / 2;
    const halfH = vp.h / 2;
    const xMin = Math.floor(cTileX - halfW / TILE_SIZE) - 1;
    const xMax = Math.floor(cTileX + halfW / TILE_SIZE) + 1;
    const yMin = Math.floor(cTileY - halfH / TILE_SIZE) - 1;
    const yMax = Math.floor(cTileY + halfH / TILE_SIZE) + 1;
    const max = 2 ** zoom;
    return {
      xMin: Math.max(0, xMin),
      xMax: Math.min(max - 1, xMax),
      yMin: Math.max(0, yMin),
      yMax: Math.min(max - 1, yMax),
    };
  }, [cTileX, cTileY, vp, zoom]);

  // ── World → viewport pixel projection (origin = container top-left) ────
  const projectLL = (p: LL) => {
    const tx = lon2tileX(p.lon, zoom);
    const ty = lat2tileY(p.lat, zoom);
    return {
      x: vp.w / 2 + (tx - cTileX) * TILE_SIZE,
      y: vp.h / 2 + (ty - cTileY) * TILE_SIZE,
    };
  };

  // Inverse: viewport pixel → world LL (accounts for live drag offset)
  const unprojectPx = (clientX: number, clientY: number): LL | null => {
    if (!wrap.current) return null;
    const r = wrap.current.getBoundingClientRect();
    const px = clientX - r.left - panPx.dx;
    const py = clientY - r.top - panPx.dy;
    const tx = cTileX + (px - vp.w / 2) / TILE_SIZE;
    const ty = cTileY + (py - vp.h / 2) / TILE_SIZE;
    return { lon: tileX2lon(tx, zoom), lat: tileY2lat(ty, zoom) };
  };

  const SNAP_M = 1.0;

  // ── Pointer handlers ───────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
    setPanPx({ dx, dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const moved = dragRef.current.moved;
    const { dx, dy } = panPx;
    dragRef.current = null;
    setPanPx({ dx: 0, dy: 0 });

    if (!moved) {
      // Treat as click — only place vertex if drawing
      if (drawing) {
        const ll = unprojectPx(e.clientX, e.clientY);
        if (!ll) return;
        let { lat, lon } = ll;
        if (snap) {
          const dLon = SNAP_M / (111320 * Math.cos((lat * Math.PI) / 180));
          const dLat = SNAP_M / 111320;
          lon = Math.round(lon / dLon) * dLon;
          lat = Math.round(lat / dLat) * dLat;
        }
        setPts((p) => [...p, { lat, lon }]);
      }
      return;
    }

    // Commit pan: shift center by tile-pixel delta
    if (dx === 0 && dy === 0) return;
    const newTileX = cTileX - dx / TILE_SIZE;
    const newTileY = cTileY - dy / TILE_SIZE;
    setCenter({
      lon: tileX2lon(newTileX, zoom),
      lat: tileY2lat(newTileY, zoom),
    });
  };

  // Wheel = cursor-centered zoom
  const onWheel = (e: React.WheelEvent) => {
    if (!wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    // World point under cursor at current zoom
    const txAtCursor = cTileX + (px - vp.w / 2) / TILE_SIZE;
    const tyAtCursor = cTileY + (py - vp.h / 2) / TILE_SIZE;
    const lon = tileX2lon(txAtCursor, zoom);
    const lat = tileY2lat(tyAtCursor, zoom);

    const newZoom = Math.max(Z_MIN, Math.min(Z_MAX, zoom + (e.deltaY > 0 ? -1 : 1)));
    if (newZoom === zoom) return;

    // After zoom, cursor should still see (lon, lat). Choose new center such that
    // the cursor-tile-coord at newZoom maps back to the same screen pixel.
    const txAtNew = lon2tileX(lon, newZoom);
    const tyAtNew = lat2tileY(lat, newZoom);
    const newCTileX = txAtNew - (px - vp.w / 2) / TILE_SIZE;
    const newCTileY = tyAtNew - (py - vp.h / 2) / TILE_SIZE;
    setZoom(newZoom);
    setCenter({
      lon: tileX2lon(newCTileX, newZoom),
      lat: tileY2lat(newCTileY, newZoom),
    });
  };

  // ── Wall length ────────────────────────────────────────────────────────
  const wallLengthM = useMemo(() => {
    if (pts.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const mPerLon = 111320 * Math.cos((a.lat * Math.PI) / 180);
      const dx = (b.lon - a.lon) * mPerLon;
      const dy = (b.lat - a.lat) * 111320;
      total += Math.hypot(dx, dy);
    }
    return total;
  }, [pts]);

  const sitePix = projectLL(SITE);
  const mpp = metersPerPixel(zoom, center.lat);
  const viewWidthM = vp.w * mpp;

  // Grid spacing in pixels at current zoom (1 m minor, 5 m major)
  const gridMinorPx = 1 / mpp;
  const gridMajorPx = 5 / mpp;
  const showMinorGrid = gridMinorPx >= 8; // hide when too dense
  const showMajorGrid = gridMajorPx >= 8;

  return (
    <div
      ref={wrap}
      className={`relative h-full w-full overflow-hidden bg-black ${
        drawing ? 'cursor-crosshair' : dragRef.current ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      style={{ touchAction: 'none' }}
    >
      {/* Tile mosaic — translated by drag offset for instant pan feedback */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${panPx.dx}px, ${panPx.dy}px, 0)`,
          willChange: 'transform',
        }}
      >
        {tileRange &&
          (() => {
            const tiles: JSX.Element[] = [];
            for (let tx = tileRange.xMin; tx <= tileRange.xMax; tx++) {
              for (let ty = tileRange.yMin; ty <= tileRange.yMax; ty++) {
                const left = vp.w / 2 + (tx - cTileX) * TILE_SIZE;
                const top = vp.h / 2 + (ty - cTileY) * TILE_SIZE;
                const localUrl = `/tiles/${zoom}/${ty}/${tx}.jpg`;
                const remoteUrl = ESRI(zoom, tx, ty);
                tiles.push(
                  <img
                    key={`${zoom}-${tx}-${ty}`}
                    src={localUrl}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== remoteUrl) img.src = remoteUrl;
                    }}
                    alt=""
                    draggable={false}
                    className="absolute select-none"
                    style={{
                      left,
                      top,
                      width: TILE_SIZE,
                      height: TILE_SIZE,
                    }}
                  />
                );
              }
            }
            return tiles;
          })()}

        {/* SVG overlay — grid + drawing (panned together with tiles) */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          {gridOn && (showMinorGrid || showMajorGrid) && (
            <>
              <defs>
                {showMinorGrid && (
                  <pattern
                    id="sat-grid"
                    width={gridMinorPx}
                    height={gridMinorPx}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${gridMinorPx} 0 L 0 0 0 ${gridMinorPx}`}
                      fill="none"
                      stroke="rgba(251,191,36,0.18)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                )}
                {showMajorGrid && (
                  <pattern
                    id="sat-grid-major"
                    width={gridMajorPx}
                    height={gridMajorPx}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${gridMajorPx} 0 L 0 0 0 ${gridMajorPx}`}
                      fill="none"
                      stroke="rgba(251,191,36,0.4)"
                      strokeWidth="0.8"
                    />
                  </pattern>
                )}
              </defs>
              {showMinorGrid && <rect width="100%" height="100%" fill="url(#sat-grid)" />}
              {showMajorGrid && <rect width="100%" height="100%" fill="url(#sat-grid-major)" />}
            </>
          )}

          {/* Site marker */}
          {sitePix.x >= -50 && sitePix.x <= vp.w + 50 && sitePix.y >= -50 && sitePix.y <= vp.h + 50 && (
            <g transform={`translate(${sitePix.x}, ${sitePix.y})`}>
              <circle r="22" fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.85" />
              <line x1="0" y1="-30" x2="0" y2="-12" stroke="#fbbf24" strokeWidth="1.5" />
              <line x1="0" y1="12" x2="0" y2="30" stroke="#fbbf24" strokeWidth="1.5" />
              <line x1="-30" y1="0" x2="-12" y2="0" stroke="#fbbf24" strokeWidth="1.5" />
              <line x1="12" y1="0" x2="30" y2="0" stroke="#fbbf24" strokeWidth="1.5" />
              <circle r="2.5" fill="#fbbf24" />
            </g>
          )}

          {/* Drawn polyline */}
          {pts.length > 1 && (
            <polyline
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pts.map((p) => {
                const q = projectLL(p);
                return `${q.x},${q.y}`;
              }).join(' ')}
            />
          )}
          {pts.map((p, i) => {
            const q = projectLL(p);
            return (
              <g key={i}>
                <rect x={q.x - 4} y={q.y - 4} width="8" height="8" fill="#fbbf24" stroke="#000" strokeWidth="1" />
                <text
                  x={q.x + 8}
                  y={q.y + 4}
                  fill="#fbbf24"
                  stroke="#000"
                  strokeWidth="3"
                  paintOrder="stroke"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {String(i + 1).padStart(2, '0')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Vignette — fixed (not panned) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* === FLOATING TOOLBAR === */}
      <div className="absolute left-3 top-12 z-10 flex items-center gap-2 border border-white/20 bg-black/75 px-2 py-1.5 backdrop-blur-sm">
        <span className="stencil">06</span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">Wall Plan</span>
        <div className="mx-1 h-5 w-px bg-white/15" />

        <button
          onClick={() => setGridOn((g) => !g)}
          className={`btn px-3 py-1.5 text-[11px] ${gridOn ? 'btn-primary' : ''}`}
          style={{ minHeight: 36 }}
        >
          GRID {gridOn ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={() => setSnap((s) => !s)}
          className={`btn px-3 py-1.5 text-[11px] ${snap ? 'btn-primary' : ''}`}
          style={{ minHeight: 36 }}
        >
          SNAP {snap ? '1M' : 'OFF'}
        </button>

        <button
          onClick={() => setDrawing((d) => !d)}
          className={`btn px-3 py-1.5 text-[11px] ${drawing ? 'btn-danger' : 'btn-primary'}`}
          style={{ minHeight: 36 }}
        >
          {drawing ? 'STOP' : 'DRAW'}
        </button>

        <button
          onClick={() => setPts([])}
          disabled={pts.length === 0}
          className="btn btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-30"
          style={{ minHeight: 36 }}
        >
          CLEAR
        </button>

        <button
          onClick={() => {
            setCenter({ lat: SITE.lat, lon: SITE.lon });
            setZoom(Z_DEFAULT);
          }}
          className="btn btn-ghost px-3 py-1.5 text-[11px]"
          style={{ minHeight: 36 }}
        >
          ◎ HOME
        </button>

        <button
          onClick={() => console.log('plan wall', pts)}
          disabled={pts.length < 2}
          className="btn px-3 py-1.5 text-[11px] disabled:opacity-30"
          style={{ minHeight: 36 }}
        >
          PLAN →
        </button>

        <div className="ml-1 flex items-center gap-2 border-l border-white/15 pl-2 text-[10px] uppercase tracking-wider text-white/50">
          <span><span className="readout">{pts.length}</span> pts</span>
          <span><span className="readout">{wallLengthM.toFixed(2)}</span> m</span>
        </div>
      </div>

      {/* === ZOOM SLIDER === */}
      <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 border border-white/20 bg-black/75 px-2 py-3 backdrop-blur-sm">
        <button
          onClick={() => setZoom((z) => Math.min(Z_MAX, z + 1))}
          className="btn btn-ghost px-2 py-0.5 text-[14px] leading-none"
          title="Zoom in"
        >
          +
        </button>
        <input
          type="range"
          min={Z_MIN}
          max={Z_MAX}
          step={1}
          value={zoom}
          onChange={(e) => setZoom(parseInt(e.target.value, 10))}
          className="h-32 w-2 appearance-none bg-white/15 accent-amber-400"
          style={{ writingMode: 'vertical-lr' as React.CSSProperties['writingMode'], direction: 'rtl' }}
          title={`Zoom z${zoom}`}
        />
        <button
          onClick={() => setZoom((z) => Math.max(Z_MIN, z - 1))}
          className="btn btn-ghost px-2 py-0.5 text-[14px] leading-none"
          title="Zoom out"
        >
          −
        </button>
        <div className="text-[9px] uppercase tracking-wider text-white/55">
          z<span className="readout">{zoom}</span>
        </div>
        <div className="text-[9px] uppercase tracking-wider text-white/45">
          <span className="readout">{viewWidthM < 1000 ? viewWidthM.toFixed(0) : (viewWidthM / 1000).toFixed(2) + 'k'}</span>m
        </div>
      </div>

      {/* Coords readout */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 border border-white/20 bg-black/55 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/75 backdrop-blur-sm">
        <span className="readout">{center.lat.toFixed(5)}°N</span>
        <span className="mx-2 text-white/30">/</span>
        <span className="readout">{center.lon.toFixed(5)}°E</span>
      </div>

      {/* Source attribution */}
      <div className="pointer-events-none absolute bottom-1 left-2 text-[9px] tracking-wide text-white/45">
        Imagery · Esri World Imagery · Tile mosaic · Drag/wheel to navigate
      </div>
    </div>
  );
}
