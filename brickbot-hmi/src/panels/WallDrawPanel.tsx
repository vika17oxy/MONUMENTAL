import { useRef, useState } from 'react';

// iPad-friendly wall-drawing overlay: touch a polyline on the top-down grid,
// then the mission backend samples it into brick positions.
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
    // TODO: POST pts (converted to world coords) to /mission/build_custom_wall
    console.log('plan wall from', pts);
  };

  return (
    <div className="absolute top-2 left-2 z-10 p-2 rounded bg-neutral-900/80 backdrop-blur border border-neutral-700 text-xs">
      <div className="flex gap-2 mb-1">
        <button onClick={() => setDrawing((d) => !d)}
                className={`px-2 py-1 rounded ${drawing ? 'bg-red-700' : 'bg-blue-700'}`}>
          {drawing ? 'Stop' : 'Draw wall'}
        </button>
        <button onClick={() => setPts([])} className="px-2 py-1 rounded bg-neutral-700">Clear</button>
        <button onClick={plan} disabled={pts.length < 2}
                className="px-2 py-1 rounded bg-green-700 disabled:opacity-40">Plan</button>
      </div>
      <svg ref={svg} width={260} height={160} onPointerDown={add}
           className="bg-neutral-950 border border-neutral-700 rounded touch-none">
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
        {pts.length > 1 && (
          <polyline fill="none" stroke="#22c55e" strokeWidth="2"
                    points={pts.map((p) => `${p.x},${p.y}`).join(' ')}/>
        )}
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#22c55e"/>)}
      </svg>
    </div>
  );
}
