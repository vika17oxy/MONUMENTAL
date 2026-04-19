import { RosProvider } from './ros/RosContext';
import { TcpJogPanel } from './panels/TcpJogPanel';
import { MissionPanel } from './panels/MissionPanel';
import { RobotSelector } from './panels/RobotSelector';
import { SensorPanel } from './panels/SensorPanel';
import { TeleopPanel } from './panels/TeleopPanel';
import { WallDrawPanel } from './panels/WallDrawPanel';
import { WorldPromptPanel } from './panels/WorldPromptPanel';
import { TwinScene } from './scene/TwinScene';

export default function App() {
  return (
    <RosProvider url="ws://localhost:9090">
      <div className="grid grid-cols-[320px_1fr_360px] grid-rows-[auto_1fr] h-full gap-2 p-2">
        <header className="col-span-3 flex items-center gap-4 border-b border-neutral-800 pb-2">
          <h1 className="text-xl font-semibold">BrickBot HMI</h1>
          <RobotSelector />
        </header>

        <aside className="flex flex-col gap-2 overflow-y-auto">
          <TcpJogPanel />
          <TeleopPanel />
          <MissionPanel />
        </aside>

        <main className="relative rounded-md border border-neutral-800 overflow-hidden">
          <TwinScene />
          <WallDrawPanel />
        </main>

        <aside className="flex flex-col gap-2 overflow-y-auto">
          <SensorPanel />
          <WorldPromptPanel />
        </aside>
      </div>
    </RosProvider>
  );
}
