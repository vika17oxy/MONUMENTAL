import { useState } from 'react';
import { RosProvider } from './ros/RosContext';
import { ControlPanel } from './panels/ControlPanel';
import { TouchJoysticks } from './panels/TouchJoysticks';
import { GamepadControl } from './input/GamepadControl';
import { WristView } from './panels/WristView';
import { MissionPanel } from './panels/MissionPanel';
import { PromptCard } from './panels/PromptCard';
import { RobotTwinView } from './scene/RobotTwinView';
import { BehaviorTreeView } from './scene/BehaviorTreeView';

type View = 'site' | 'bt';

export default function App() {
  const [view, setView] = useState<View>('site');

  return (
    <RosProvider url={`ws://${location.hostname}:9090`}>
      <div className="grid h-full grid-cols-[380px_1fr_420px] grid-rows-[auto_1fr] gap-3 p-3">
        {/* === TOP BAR === */}
        <header className="col-span-3 flex items-center gap-4 panel px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="hazard h-6 w-6" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold uppercase tracking-[0.35em] text-accent">MONUMENTAL</span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">HMI · v0.1 · build 2026.04</span>
            </div>
          </div>

          <div className="mx-4 h-5 w-px bg-white/15" />

          <nav className="flex items-center gap-1 text-[11px] uppercase tracking-[0.18em]">
            <span className="px-3 py-1.5 border border-white/30 text-white bg-white/5">Operate</span>
          </nav>

          <div className="mx-4 h-5 w-px bg-white/15" />

          {/* === VIEW SWITCHER === */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/35">View</span>
            <div className="flex border border-white/15">
              <button
                onClick={() => setView('site')}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  view === 'site'
                    ? 'bg-accent text-black font-bold'
                    : 'text-white/55 hover:text-white hover:bg-white/5'
                }`}
                style={{ minHeight: 32 }}
              >
                ◆ Site
              </button>
              <button
                onClick={() => setView('bt')}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] border-l border-white/15 transition-colors ${
                  view === 'bt'
                    ? 'bg-accent text-black font-bold'
                    : 'text-white/55 hover:text-white hover:bg-white/5'
                }`}
                style={{ minHeight: 32 }}
              >
                ⌗ BT
              </button>
            </div>
          </div>

        </header>

        {/* === LEFT COLUMN: operator controls + wrist cam === */}
        {/* end the scroll area above the corner touch joysticks (no overlap) */}
        <aside className="flex flex-col gap-3 overflow-y-auto pr-1 pb-72">
          <ControlPanel />
          <WristView />
        </aside>

        {/* === CENTER: SCENE === */}
        <main className="panel relative overflow-hidden">
          <span className="corner-tl" />
          <span className="corner-br" />
          {view === 'site' && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/60">
              <span className="stencil">SITE</span>
              <span>Satellite · Live 3D · Wall planner</span>
            </div>
          )}
          <div className="absolute inset-0">
            {view === 'site' ? <RobotTwinView /> : <BehaviorTreeView />}
          </div>
          {/* DJI-style joysticks float in the screen's bottom corners — always visible. */}
          <TouchJoysticks />
        </main>

        {/* === RIGHT COLUMN: behavior tree === */}
        <aside className="flex flex-col gap-3 overflow-y-auto pr-1 pb-72">
          <MissionPanel />
          <PromptCard />
        </aside>
      </div>

      {/* Bluetooth Xbox controller mapping (shows a legend when connected) */}
      <GamepadControl />
    </RosProvider>
  );
}
