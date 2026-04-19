import { useState } from 'react';

export function WorldPromptPanel() {
  const [prompt, setPrompt] = useState('spawn 5 bricks at random poses on the pallet');
  return (
    <section className="rounded border border-neutral-800 p-3 bg-neutral-950">
      <h2 className="font-semibold mb-2">World Prompt (LLM)</h2>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-sm font-mono h-24"/>
      <button className="mt-2 w-full rounded bg-purple-700 hover:bg-purple-600 py-2 text-sm">
        Send to MCP
      </button>
      <p className="text-xs text-neutral-500 mt-1">Routes through brickbot_mcp → Claude → Gazebo.</p>
    </section>
  );
}
