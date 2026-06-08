import { useRef, useState } from 'react';

type Pt = { x: number; y: number };

export function WallDrawPanel() {
  const svg = useRef<SVGSVGElement | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const [drawing, setDrawing] = useState(false);

  const add = (e: React.PointerEvent) => {
    if (!drawing || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    setPts((p) => [...p, { x: e.clientX - r.left, y: e.clientY - r.top }]);
  };

  const plan = () => {
    console.log('plan wall from', pts);
  };

  return (
    <div className="absolute left-3 top-12 z-10 border border-white/20 bg-black/80 p-2 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-white/50">
        <span className="flex items-center gap-1.5"><span className="stencil">06</span>Wall Plan</span>
        <span className="readout text-white/40">{pts.length} pts</span>
      </div>

      <div className="mb-1.5 flex gap-1">
        <button
          onClick={() => setDrawing((d) => !d)}
          className={`btn px-2 py-1 text-[10px] ${drawing ? 'btn-danger' : 'btn-primary'}`}
        >
          {drawing ? 'STOP' : 'DRAW'}
        </button>
        <button onClick={() => setPts([])} className="btn btn-ghost px-2 py-1 text-[10px]">
          CLEAR
        </button>
        <button
          onClick={plan}
          disabled={pts.length < 2}
          className="btn px-2 py-1 text-[10px] disabled:opacity-30"
        >
          PLAN
        </button>
      </div>

      <svg
        ref={svg}
        width={260}
        height={160}
        onPointerDown={add}
        className="block touch-none border border-white/15 bg-black"
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* Axis markers */}
        <line x1="0" y1="80" x2="260" y2="80" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <line x1="130" y1="0" x2="130" y2="160" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />

        {pts.length > 1 && (
          <polyline
            fill="none"
            stroke="#fafafa"
            strokeWidth="1.5"
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <rect x={p.x - 2.5} y={p.y - 2.5} width="5" height="5" fill="#fafafa" />
            <text x={p.x + 6} y={p.y + 3} fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="monospace">
              {String(i + 1).padStart(2, '0')}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[9px] uppercase tracking-widest text-white/30">
        <span>TOP-DOWN · 2.6 × 1.6 m</span>
        <span>1 px = 10 mm</span>
      </div>
    </div>
  );
}
