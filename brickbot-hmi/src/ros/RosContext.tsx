import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import ROSLIB from 'roslib';

type RosState = {
  ros: ROSLIB.Ros | null;
  connected: boolean;
  selectedRobot: 'robot_a' | 'robot_b';
  setSelectedRobot: (r: 'robot_a' | 'robot_b') => void;
};

const Ctx = createContext<RosState | null>(null);

export function RosProvider({ url, children }: { url: string; children: ReactNode }) {
  const [ros, setRos] = useState<ROSLIB.Ros | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<'robot_a' | 'robot_b'>('robot_a');

  useEffect(() => {
    const r = new ROSLIB.Ros({ url });
    r.on('connection', () => setConnected(true));
    r.on('close', () => setConnected(false));
    r.on('error', () => setConnected(false));
    setRos(r);
    return () => r.close();
  }, [url]);

  return (
    <Ctx.Provider value={{ ros, connected, selectedRobot, setSelectedRobot }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRos(): RosState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRos must be inside RosProvider');
  return v;
}
