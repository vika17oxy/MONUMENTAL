import { useEffect, useRef, useState } from 'react';
import { useRos } from '../ros/RosContext';

const R = 80; // max knob travel (px)

type Edges = { top?: string; bottom?: string; left?: string; right?: string };

/** A single analog touch joystick. Reports a normalized vector in [-1, 1]
 *  (x: right+, y: up+). axis='vertical' locks it to up/down only. */
function Stick({
  title, edges, axis, onVec,
}: { title: string; edges: Edges; axis?: 'both' | 'vertical'; onVec: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const live = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);   // touch-down point = neutral centre
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  // Natural touch feel: wherever you press becomes the centre; the knob & vector
  // follow your RELATIVE drag from that point (not the absolute press location).
  const handle = (e: React.PointerEvent) => {
    if (!origin.current) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    if (axis === 'vertical') dx = 0;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    onVec(dx / R, -dy / R);            // invert y: screen-down is world-negative
  };
  const start = (e: React.PointerEvent) => {
    live.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY };   // press point is the new centre
    setKnob({ x: 0, y: 0 });
    onVec(0, 0);
  };
  const move = (e: React.PointerEvent) => { if (live.current) handle(e); };
  const end = () => { live.current = false; origin.current = null; setKnob({ x: 0, y: 0 }); onVec(0, 0); };

  const tag = 'pointer-events-none absolute text-[9px] font-bold uppercase tracking-wider text-accent/70';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="rounded-sm bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-white/70 backdrop-blur">
        {title}
      </span>
      <div
        ref={base}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        className="relative h-48 w-48 touch-none select-none rounded-full border-2 border-accent/70 bg-black/45 shadow-[0_0_34px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/15 backdrop-blur"
      >
        {/* crosshair */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 -translate-y-1/2 bg-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-px -translate-x-1/2 -translate-y-1/2 bg-white/15" />
        {/* axis labels */}
        {edges.top && <span className={`${tag} left-1/2 top-2 -translate-x-1/2`}>{edges.top}</span>}
        {edges.bottom && <span className={`${tag} bottom-2 left-1/2 -translate-x-1/2`}>{edges.bottom}</span>}
        {edges.left && <span className={`${tag} left-2 top-1/2 -translate-y-1/2`}>{edges.left}</span>}
        {edges.right && <span className={`${tag} right-2 top-1/2 -translate-y-1/2`}>{edges.right}</span>}
        {/* knob */}
        <div
          className="absolute left-1/2 top-1/2 h-20 w-20 rounded-full bg-accent shadow-lg ring-2 ring-black/40 transition-transform duration-75"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
    </div>
  );
}

/** Two corner joysticks for live IK jogging (robot_a / V.I.K.A-6 only).
 *  Left = X/Y ground plane, Right = Z up/down. Push further → move faster.
 *  Mounted inside the scene view so it never covers the control panels. */
export function TouchJoysticks() {
  const { sendTcpJog } = useRos();
  const left = useRef({ x: 0, y: 0 });
  const right = useRef({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);

  const STEP = 0.16; // metres per tick at full deflection (fast)
  const tick = () => {
    const dx = left.current.x * STEP;
    const dy = left.current.y * STEP;
    const dz = right.current.y * STEP;
    if (dx || dy || dz) sendTcpJog(dx, dy, dz);
  };
  const refresh = () => {
    const idle = !left.current.x && !left.current.y && !right.current.x && !right.current.y;
    if (idle && timer.current !== null) { clearInterval(timer.current); timer.current = null; }
    if (!idle && timer.current === null) { timer.current = window.setInterval(tick, 50); }  // ~20 Hz
  };
  useEffect(() => () => { if (timer.current !== null) clearInterval(timer.current); }, []);

  // Always visible — pinned to the very bottom corners of the SCREEN (viewport-fixed),
  // easy to reach with both thumbs on an iPad. No bar / no wasted space between them.
  return (
    <>
      <div className="pointer-events-auto fixed bottom-12 left-12 z-30">
        <Stick title="Move · X / Y" edges={{ top: '+Y', bottom: '−Y', left: '−X', right: '+X' }}
          onVec={(x, y) => { left.current = { x, y }; refresh(); }} />
      </div>
      <div className="pointer-events-auto fixed bottom-12 right-12 z-30">
        <Stick title="Lift · Z" axis="vertical" edges={{ top: 'Up', bottom: 'Down' }}
          onVec={(x, y) => { right.current = { x, y }; refresh(); }} />
      </div>
    </>
  );
}
