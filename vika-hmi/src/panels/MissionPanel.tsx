import { useMemo, useState } from 'react';
import { Panel } from '../components/ui/Panel';
import { useRos } from '../ros/RosContext';
import { TNode, buildTree, groupChildren, activeIteration } from '../scene/btTree';

const COLOR: Record<string, string> = {
  IDLE: 'text-white/40',
  RUNNING: 'text-accent',
  SUCCESS: 'text-green-400',
  FAILURE: 'text-red-400',
};
const DOT: Record<string, string> = {
  IDLE: 'bg-white/25',
  RUNNING: 'bg-accent animate-pulse',
  SUCCESS: 'bg-green-400',
  FAILURE: 'bg-red-400',
};
// node-type glyphs (BT convention): → sequence, ? fallback, ◇ condition, ▸ action
const GLYPH: Record<string, string> = {
  sequence: '→',
  fallback: '?',
  condition: '◇',
  action: '▸',
};

type Row = {
  key: string; prefix: string; connector: string;
  type: string; name: string; status: string; running: boolean;
  isLoop?: boolean; groupKey?: number; total?: number; doneCount?: number;
  dots?: string[]; iterLabel?: string;
};

function emit(rows: Row[], children: TNode[], parentPrefix: string, expanded: Set<number>) {
  const groups = groupChildren(children);
  groups.forEach((g, gi) => {
    const last = gi === groups.length - 1;
    const connector = last ? '└─' : '├─';
    const childPrefix = parentPrefix + (last ? '   ' : '│  ');

    if (g.kind === 'single') {
      const node = g.node;
      rows.push({
        key: 'n' + node.idx, prefix: parentPrefix, connector,
        type: node.type, name: node.name, status: node.status, running: node.status === 'RUNNING',
      });
      emit(rows, node.children, childPrefix, expanded);
      return;
    }

    const { nodes } = g;
    const gk = nodes[0].idx;
    const total = nodes.length;
    // current iteration: the running one, else first not-yet-done, else the last (all done)
    const active = activeIteration(nodes);
    const activeIdx = nodes.indexOf(active) + 1;
    rows.push({
      key: 'loop' + gk, prefix: parentPrefix, connector,
      type: nodes[0].type, name: nodes[0].name.replace(/\d+/g, 'N'),
      status: nodes[0].status, running: nodes.some((n) => n.status === 'RUNNING'),
      isLoop: true, groupKey: gk, total, doneCount: activeIdx,
      dots: nodes.map((n) => n.status),
    });

    if (expanded.has(gk)) {
      // expanded: render every iteration in full, with its own header
      nodes.forEach((node, ni) => {
        const nlast = ni === nodes.length - 1;
        rows.push({
          key: 'n' + node.idx, prefix: childPrefix, connector: nlast ? '└─' : '├─',
          type: node.type, name: node.name, status: node.status, running: node.status === 'RUNNING',
        });
        emit(rows, node.children, childPrefix + (nlast ? '   ' : '│  '), expanded);
      });
    } else {
      // collapsed: all iterations are identical, so show the body ONCE (no per-iteration
      // header) directly under the loop row — the counter on the loop row says which one.
      emit(rows, active.children, childPrefix, expanded);
    }
  });
}

export function MissionPanel() {
  const { connected, btNodes, btRunning, sendMission } = useRos();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (k: number) => setExpanded((prev) => {
    const s = new Set(prev);
    s.has(k) ? s.delete(k) : s.add(k);
    return s;
  });

  const rows = useMemo(() => {
    const root = buildTree(btNodes);
    const out: Row[] = [];
    if (root) {
      out.push({
        key: 'n' + root.idx, prefix: '', connector: '',
        type: root.type, name: root.name, status: root.status, running: root.status === 'RUNNING',
      });
      emit(out, root.children, '', expanded);
    }
    return out;
  }, [btNodes, expanded]);

  const acts = btNodes.filter((n) => n.type === 'action' || n.type === 'condition');
  const done = acts.filter((n) => n.status === 'SUCCESS').length;

  return (
    <Panel
      title="Mission"
      subtitle="· behavior tree"
      right={<span className="flex items-center gap-1.5">
        <span className={`dot ${btRunning ? 'dot-live' : 'dot-off'}`} />{btRunning ? 'RUN' : 'IDLE'}
      </span>}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => sendMission('AUTO')} disabled={!connected || btRunning}
          className="btn btn-primary py-2.5 disabled:opacity-30">⟳ AUTO</button>
        <button onClick={() => sendMission('STOP')} disabled={!connected}
          className="btn btn-danger py-2.5 disabled:opacity-30">■ STOP</button>
        <button onClick={() => sendMission('START')} disabled={!connected || btRunning}
          className="btn py-2 text-[11px] disabled:opacity-30">▦ Build (VIKA-6)</button>
        <button onClick={() => sendMission('CEMENT')} disabled={!connected || btRunning}
          className="btn py-2 text-[11px] disabled:opacity-30">≋ Cement (VIKA-5)</button>
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-white/30">
        Auto = VIKA-6 baut die Mauer → VIKA-5 cementiert. Oder einzeln.
      </div>

      <div className="mt-3 border border-white/10 bg-black/25 p-2.5">
        <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-white/40">
          <span>behavior tree</span>
          <span className="readout readout-dim">{done} / {acts.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="py-3 text-center text-[10px] uppercase tracking-wider text-white/25">
            no tree (start bt_node)
          </div>
        ) : (
          <div className="font-mono text-[11px] leading-[1.7]">
            {rows.map((n) => {
              if (n.isLoop) {
                return (
                  <div key={n.key} onClick={() => toggle(n.groupKey!)}
                    title={expanded.has(n.groupKey!) ? 'einklappen' : 'alle Iterationen zeigen'}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-1 hover:bg-white/5 ${n.running ? 'bg-accent/10' : ''}`}>
                    <span className="whitespace-pre text-white/20">{n.prefix}{n.connector}</span>
                    <span className="shrink-0 text-accent/70">⟳</span>
                    <span className="shrink-0 truncate font-bold text-white/80">{n.name}</span>
                    <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] text-white/50">×{n.total}</span>
                    <span className="flex flex-wrap items-center gap-px">
                      {n.dots!.map((s, di) => (
                        <span key={di} className={`inline-block h-1 w-1 rounded-full ${DOT[s] ?? 'bg-white/25'}`} />
                      ))}
                    </span>
                    <span className="ml-auto shrink-0 text-[9px] text-white/40">{n.doneCount}/{n.total}</span>
                  </div>
                );
              }
              return (
                <div key={n.key}
                  className={`flex items-center gap-1.5 rounded-sm px-1 ${n.running ? 'bg-accent/10' : ''}`}>
                  <span className="whitespace-pre text-white/20">{n.prefix}{n.connector}</span>
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[n.status] ?? 'bg-white/25'}`} />
                  <span className={`shrink-0 ${n.type === 'sequence' ? 'text-accent/70' : n.type === 'fallback' ? 'text-sky-400/70' : 'text-white/30'}`}>
                    {GLYPH[n.type] ?? '·'}
                  </span>
                  <span className={`truncate ${COLOR[n.status] ?? 'text-white/50'} ${n.type === 'sequence' || n.type === 'fallback' ? 'font-bold' : ''}`}>
                    {n.name}
                  </span>
                  {n.iterLabel && <span className="shrink-0 text-[9px] text-white/30">{n.iterLabel}</span>}
                  {n.running && <span className="ml-auto shrink-0 text-[8px] uppercase tracking-wider text-accent">running</span>}
                  {n.status === 'SUCCESS' && <span className="ml-auto shrink-0 text-[9px] text-green-400/80">✓</span>}
                  {n.status === 'FAILURE' && <span className="ml-auto shrink-0 text-[9px] text-red-400/80">✕</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-white/30">
        → sequence · ? fallback · ◇ condition · ▸ action · ⟳ loop (klick = alle zeigen)
      </div>
    </Panel>
  );
}
