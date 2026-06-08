import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import ROSLIB from 'roslib';

export type JointMap = Record<string, number>;

type RosState = {
  ros: ROSLIB.Ros | null;
  connected: boolean;
  selectedRobot: 'robot_a' | 'robot_b';
  setSelectedRobot: (r: 'robot_a' | 'robot_b') => void;
  /** Latest joint positions keyed by joint name. Updates ~30Hz from /joint_states. */
  jointsRef: React.MutableRefObject<JointMap>;
  /** Trigger rerenders if a UI panel needs joint readouts (rare). */
  jointsTick: number;
  /** Helpers — publish to /hmi/* topics consumed by hmi_bridge.py. */
  sendCmd: (cmd: 'HOME' | 'STOP') => void;
  sendJointJog: (deltas: number[]) => void;
  sendTcpJog: (dx: number, dy: number, dz: number) => void;
};

const Ctx = createContext<RosState | null>(null);

export function RosProvider({ url, children }: { url: string; children: ReactNode }) {
  const [ros, setRos] = useState<ROSLIB.Ros | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<'robot_a' | 'robot_b'>('robot_a');
  const jointsRef = useRef<JointMap>({});
  const [jointsTick, setJointsTick] = useState(0);
  const cmdPubRef = useRef<ROSLIB.Topic | null>(null);
  const jogPubRef = useRef<ROSLIB.Topic | null>(null);
  const tcpPubRef = useRef<ROSLIB.Topic | null>(null);

  useEffect(() => {
    const r = new ROSLIB.Ros({ url });
    r.on('connection', () => setConnected(true));
    r.on('close', () => setConnected(false));
    r.on('error', () => setConnected(false));
    setRos(r);

    const jsTopic = new ROSLIB.Topic({
      ros: r,
      name: '/joint_states',
      messageType: 'sensor_msgs/JointState',
      throttle_rate: 30,
    });
    let lastTick = 0;
    jsTopic.subscribe((msg: any) => {
      const names: string[] = msg.name ?? [];
      const pos: number[] = msg.position ?? [];
      const map = jointsRef.current;
      for (let i = 0; i < names.length; i++) map[names[i]] = pos[i];
      const now = performance.now();
      if (now - lastTick > 100) {
        lastTick = now;
        setJointsTick((t) => t + 1);
      }
    });

    cmdPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/cmd', messageType: 'std_msgs/String',
    });
    jogPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/joint_jog', messageType: 'std_msgs/Float64MultiArray',
    });
    tcpPubRef.current = new ROSLIB.Topic({
      ros: r, name: '/hmi/tcp_jog', messageType: 'geometry_msgs/Vector3',
    });

    return () => {
      jsTopic.unsubscribe();
      r.close();
    };
  }, [url]);

  const sendCmd = (cmd: 'HOME' | 'STOP') => {
    cmdPubRef.current?.publish(new ROSLIB.Message({ data: cmd }));
  };
  const sendJointJog = (deltas: number[]) => {
    if (deltas.length !== 6) return;
    jogPubRef.current?.publish(new ROSLIB.Message({ data: deltas, layout: { dim: [], data_offset: 0 } }));
  };
  const sendTcpJog = (dx: number, dy: number, dz: number) => {
    tcpPubRef.current?.publish(new ROSLIB.Message({ x: dx, y: dy, z: dz }));
  };

  return (
    <Ctx.Provider value={{
      ros, connected, selectedRobot, setSelectedRobot,
      jointsRef, jointsTick,
      sendCmd, sendJointJog, sendTcpJog,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRos(): RosState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRos must be inside RosProvider');
  return v;
}
