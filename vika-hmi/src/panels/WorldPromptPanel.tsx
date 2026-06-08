import { useState } from 'react';
import { Panel } from '../components/ui/Panel';

export function WorldPromptPanel() {
  const [prompt, setPrompt] = useState('spawn 5 bricks at random poses on the pallet');
  return (
    <Panel
      id="05"
      title="World Prompt"
      subtitle="· MCP"
      right={<span className="text-white/50">⌘ + ⏎</span>}
    >
      <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/40">
        <span className="border border-white/15 px-1.5 py-0.5">claude-opus-4.7</span>
        <span>→ monumental_mcp → Gazebo</span>
      </div>

      <div className="relative">
        <span className="absolute left-2 top-1.5 text-[10px] font-mono text-white/30">&gt;_</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="input h-24 resize-none pl-7 pt-1.5 leading-relaxed"
          placeholder="describe the scene…"
        />
      </div>

      <button className="btn btn-primary mt-2 w-full py-2.5 tracking-widest">
        DISPATCH →
      </button>

      <div className="mt-2 flex items-center justify-between text-[9px] uppercase tracking-widest text-white/30">
        <span>Tokens <span className="readout text-white/60">~42</span></span>
        <span>Latency <span className="readout text-white/60">—</span></span>
      </div>
    </Panel>
  );
}
