import { useEffect, useMemo, useRef, useState } from 'react';
import { useRos } from '../ros/RosContext';
import { TNode, buildTree, groupChildren, activeIteration } from './btTree';

type DNode = {
  key: string; name: string; type: string; status: string;
  depth: number; x: number; gx: number; gy: number; children: DNode[];
  loop?: { total: number; activeIdx: number };
};

const NODE_W = 158;
const NODE_H = 52;
const STEP_X = NODE_W + 22;
const STEP_Y = 104;

const TYPE: Record<string, { kind: string; accent: string }> = {
  sequence: { kind: '→ Sequence', accent: '#e0654a' },
  fallback: { kind: '? Fallback', accent: '#4aa3e0' },
  condition: { kind: 'Condition', accent: '#46c46a' },
  action: { kind: 'Action', accent: '#d9b84a' },
};
const STATUS_RING: Record<string, string> = {
  IDLE: 'rgba(255,255,255,0.12)',
  RUNNING: '#fbbf24',
  SUCCESS: '#34d399',
  FAILURE: '#f87171',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const mk = (n: TNode, depth: number): DNode => ({
  key: 'n' + n.idx, name: n.name, type: n.type, status: n.status,
  depth, x: 0, gx: 0, gy: 0, children: buildChildren(n.children, depth + 1),
});

// a long run of leaf steps (e.g. the loop body) is packed into a grid instead of one
// wide row, so the tree stays roughly square. cols chosen to make the block ~square.
const isLeafGrid = (n: DNode) => n.children.length > 4 && n.children.every((c) => !c.children.length);
const gridCols = (k: number) => Math.max(1, Math.round(Math.sqrt((k * STEP_Y) / STEP_X)));

function measure(n: DNode): { w: number; h: number } {
  if (!n.children.length) return { w: 1, h: 1 };
  if (isLeafGrid(n)) {
    const cols = gridCols(n.children.length);
    return { w: cols, h: 1 + Math.ceil(n.children.length / cols) };
  }
  let w = 0, hmax = 0;
  for (const c of n.children) { const m = measure(c); w += m.w; hmax = Math.max(hmax, m.h); }
  return { w: Math.max(w, 1), h: 1 + hmax };
}

// assign grid coords (gx col, gy row); parents centre over their children
function place(n: DNode, col: number, row: number) {
  n.gy = row;
  if (!n.children.length) { n.gx = col; return; }
  if (isLeafGrid(n)) {
    const cols = gridCols(n.children.length);
    n.children.forEach((c, i) => { c.gx = col + (i % cols); c.gy = row + 1 + Math.floor(i / cols); });
    n.gx = col + (cols - 1) / 2;
    return;
  }
  let cx = col;
  for (const c of n.children) { place(c, cx, row + 1); cx += measure(c).w; }
  n.gx = (n.children[0].gx + n.children[n.children.length - 1].gx) / 2;
}

// collapse runs of identical sibling subtrees into a single "loop" node (for-block).
// The graph never expands them — the body is shown once with a counter (e.g. 1/2).
function buildChildren(children: TNode[], depth: number): DNode[] {
  const out: DNode[] = [];
  for (const g of groupChildren(children)) {
    if (g.kind === 'single') { out.push(mk(g.node, depth)); continue; }
    const { nodes } = g;
    const active = activeIteration(nodes);
    out.push({
      key: 'loop' + nodes[0].idx, name: nodes[0].name.replace(/\d+/g, 'N'),
      type: nodes[0].type, status: active.status,
      depth, x: 0, gx: 0, gy: 0, loop: { total: nodes.length, activeIdx: nodes.indexOf(active) + 1 },
      children: buildChildren(active.children, depth + 1),
    });
  }
  return out;
}

const flat = (root: DNode | null): DNode[] => {
  const out: DNode[] = [];
  const go = (n: DNode) => { out.push(n); n.children.forEach(go); };
  if (root) go(root);
  return out;
};

export function BehaviorTreeView() {
  const { btNodes, btRunning, sendMission, connected } = useRos();
  const wrap = useRef<HTMLDivElement | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const userMoved = useRef(false);
  const dragRef = useRef<null | { sx: number; sy: number; vx: number; vy: number }>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes, links, W, H } = useMemo(() => {
    const root = buildTree(btNodes);
    const rootD = root ? mk(root, 0) : null;
    if (rootD) place(rootD, 0, 0);
    const ns = flat(rootD);
    const maxX = ns.reduce((m, n) => Math.max(m, n.gx), 0);
    const maxY = ns.reduce((m, n) => Math.max(m, n.gy), 0);
    const lk = ns.flatMap((p) => p.children.map((c) => ({ p, c })));
    return { nodes: ns, links: lk, W: (maxX + 1) * STEP_X, H: (maxY + 1) * STEP_Y };
  }, [btNodes]);

  const fit = () => {
    if (!vp.w || !W) return { k: 1, x: 0, y: 0 };
    const k = Math.min(2.2, (vp.w - 60) / W, (vp.h - 60) / H);
    return { k, x: (vp.w - W * k) / 2, y: (vp.h - H * k) / 2 };
  };
  const reset = () => { userMoved.current = false; setView(fit()); };

  // auto-fit until the user pans/zooms (or after a reset)
  useEffect(() => {
    if (!userMoved.current) setView(fit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, vp.w, vp.h]);

  // wheel zoom around the cursor (native listener so we can preventDefault)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      userMoved.current = true;
      setView((v) => {
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.0015), 0.15, 4);
        const r = k / v.k;
        return { k, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    movedRef.current = false;
  };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) { movedRef.current = true; userMoved.current = true; }
      setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

  const px = (n: DNode) => n.gx * STEP_X + NODE_W / 2;
  const py = (n: DNode) => n.gy * STEP_Y;

  return (
    <div
      ref={wrap}
      onPointerDown={onPointerDown}
      className="relative h-full w-full cursor-grab overflow-hidden bg-[#11151a] active:cursor-grabbing"
    >
      {/* dotted grid backdrop */}
      <div className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

      <div className="pointer-events-none absolute left-4 top-3 z-10 text-[10px] uppercase tracking-[0.25em] text-white/60">
        <span className="stencil">BT</span> Behavior Tree · {btRunning ? <span className="text-accent">RUNNING</span> : 'idle'}
      </div>
      <div className="absolute right-4 top-3 z-10 flex gap-1.5">
        <button onClick={() => sendMission('START')} disabled={!connected || btRunning}
          className="btn btn-primary px-3 py-1.5 text-[11px] disabled:opacity-30">▶ START</button>
        <button onClick={() => sendMission('STOP')} disabled={!connected}
          className="btn btn-danger px-3 py-1.5 text-[11px] disabled:opacity-30">■ STOP</button>
      </div>

      {/* zoom / pan controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
        <button onClick={() => setView((v) => ({ ...v, k: clamp(v.k * 1.2, 0.15, 4) }))}
          className="btn h-8 w-8 text-sm leading-none">+</button>
        <button onClick={() => setView((v) => ({ ...v, k: clamp(v.k / 1.2, 0.15, 4) }))}
          className="btn h-8 w-8 text-sm leading-none">−</button>
        <button onClick={reset} title="reset view"
          className="btn h-8 w-8 text-[10px] leading-none">⤾</button>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 text-[9px] uppercase tracking-wider text-white/30">
        scroll = zoom · drag = pan · ⟳ block = for-loop (1/N)
      </div>

      {nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-wider text-white/25">
          waiting for behavior tree (bt_node)…
        </div>
      ) : (
        <div className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <div className="relative" style={{ width: W, height: H }}>
            {/* links */}
            <svg className="absolute left-0 top-0 overflow-visible" width={W} height={H}>
              {links.map(({ p, c }) => {
                const x1 = px(p), y1 = py(p) + NODE_H, x2 = px(c), y2 = py(c);
                const my = y1 + (y2 - y1) / 2;
                const live = c.status === 'RUNNING' || c.status === 'SUCCESS';
                return (
                  <path key={`${p.key}-${c.key}`} d={`M ${x1} ${y1} V ${my} H ${x2} V ${y2}`}
                    fill="none" stroke={live ? '#34d399' : '#1f8f8f'} strokeWidth={live ? 2.4 : 1.6}
                    opacity={live ? 0.95 : 0.6} />
                );
              })}
            </svg>
            {/* nodes */}
            {nodes.map((n) => {
              const t = TYPE[n.type] ?? TYPE.action;
              const ring = STATUS_RING[n.status] ?? STATUS_RING.IDLE;
              const running = n.status === 'RUNNING';
              const isLoop = !!n.loop;
              return (
                <div key={n.key}
                  className="absolute rounded-md"
                  style={{
                    left: px(n) - NODE_W / 2, top: py(n), width: NODE_W, height: NODE_H,
                    background: '#1b2029',
                    border: `2px solid ${ring}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  }}>
                  <div className="flex items-center gap-1.5 px-2 pt-1 text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: isLoop ? '#c4a3e0' : t.accent }}>
                    <span className="h-1.5 w-1.5 rounded-full"
                      style={{ background: ring, animation: running ? 'pulse 1s infinite' : undefined }} />
                    {isLoop ? `⟳ Loop` : t.kind}
                    {isLoop && (
                      <span className="ml-auto rounded bg-white/10 px-1 text-white/70">
                        {n.loop!.activeIdx}/{n.loop!.total}
                      </span>
                    )}
                  </div>
                  <div className="truncate px-2 text-[12px] font-semibold text-white/90">{n.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
