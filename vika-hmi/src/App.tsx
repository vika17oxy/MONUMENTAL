import { useState } from 'react';
import { RosProvider } from './ros/RosContext';
import { TcpJogPanel } from './panels/TcpJogPanel';
import { MissionPanel } from './panels/MissionPanel';
import { RobotSelector } from './panels/RobotSelector';
import { SensorPanel } from './panels/SensorPanel';
import { TeleopPanel } from './panels/TeleopPanel';
import { WorldPromptPanel } from './panels/WorldPromptPanel';
import { SatelliteMockView } from './scene/SatelliteMockView';
import { RobotTwinView } from './scene/RobotTwinView';

type View = 'map' | 'twin';

export default function App() {
  const [view, setView] = useState<View>('map');

  return (
    <RosProvider url="ws://localhost:9090">
      <div className="grid h-full grid-cols-[380px_1fr_420px] grid-rows-[auto_1fr_auto] gap-3 p-3">
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
            <span className="px-3 py-1.5 text-white/45 hover:text-white cursor-pointer">Program</span>
            <span className="px-3 py-1.5 text-white/45 hover:text-white cursor-pointer">Calibrate</span>
            <span className="px-3 py-1.5 text-white/45 hover:text-white cursor-pointer">Logs</span>
          </nav>

          <div className="mx-4 h-5 w-px bg-white/15" />

          {/* === VIEW SWITCHER === */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/35">View</span>
            <div className="flex border border-white/15">
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${
                  view === 'map'
                    ? 'bg-accent text-black font-bold'
                    : 'text-white/55 hover:text-white hover:bg-white/5'
                }`}
                style={{ minHeight: 32 }}
              >
                ◰ Map 2D
              </button>
              <button
                onClick={() => setView('twin')}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] border-l border-white/15 transition-colors ${
                  view === 'twin'
                    ? 'bg-accent text-black font-bold'
                    : 'text-white/55 hover:text-white hover:bg-white/5'
                }`}
                style={{ minHeight: 32 }}
              >
                ◆ Twin 3D
              </button>
            </div>
          </div>

          <div className="ml-auto">
            <RobotSelector />
          </div>
        </header>

        {/* === LEFT COLUMN === */}
        <aside className="flex flex-col gap-3 overflow-y-auto pr-1">
          <TcpJogPanel />
          <TeleopPanel />
          <MissionPanel />
        </aside>

        {/* === CENTER: SCENE === */}
        <main className="panel relative overflow-hidden">
          <span className="corner-tl" />
          <span className="corner-br" />
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/60">
            <span className="stencil">{view === 'map' ? 'MAP' : 'TWIN'}</span>
            <span>{view === 'map' ? 'Satellite · Site Survey' : 'Robot · Digital Twin'}</span>
          </div>
          <div className="pointer-events-none absolute right-3 top-3 z-10 text-[10px] uppercase tracking-[0.25em] text-white/60">
            <span className="readout">X 0.000</span>
            <span className="mx-2 text-white/20">|</span>
            <span className="readout">Y 0.000</span>
            <span className="mx-2 text-white/20">|</span>
            <span className="readout">Z 0.000</span>
          </div>
          <div className="absolute inset-0">
            {view === 'map' ? <SatelliteMockView /> : <RobotTwinView />}
          </div>
        </main>

        {/* === RIGHT COLUMN === */}
        <aside className="flex flex-col gap-3 overflow-y-auto pr-1">
          <SensorPanel />
          <WorldPromptPanel />
        </aside>

        {/* === STATUS BAR === */}
        <footer className="col-span-3 flex items-center gap-6 panel px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] text-white/55">
          <span>SYS <span className="readout ml-2">NOMINAL</span></span>
          <span>CPU <span className="readout ml-2">12%</span></span>
          <span>RT <span className="readout ml-2">1000 Hz</span></span>
          <span>BT <span className="readout ml-2">idle</span></span>
          <span className="ml-auto">Site · Hall-07 · Cell-02 · 2026-04-19</span>
        </footer>
      </div>
    </RosProvider>
  );
}
