import { BtNodeState } from '../ros/RosContext';

export type TNode = BtNodeState & { children: TNode[]; idx: number };

/** Rebuild the parent/child tree from the flat, depth-tagged node list. */
export function buildTree(nodes: BtNodeState[]): TNode | null {
  if (!nodes.length) return null;
  const stack: TNode[] = [];
  let root: TNode | null = null;
  nodes.forEach((n, i) => {
    const t: TNode = { ...n, children: [], idx: i };
    if (n.depth === 0) { root = t; stack[0] = t; }
    else { stack[n.depth - 1]?.children.push(t); stack[n.depth] = t; }
  });
  return root;
}

/** Structural signature ignoring the node's OWN name — two iterations of the same
 *  loop body (e.g. "Seg 1 · Course 1" / "Seg 2 · Course 1") share one signature. */
export function sig(n: TNode): string {
  return n.type + '[' + n.children.map((c) => c.name + sig(c)).join(',') + ']';
}

export const containsRunning = (n: TNode): boolean =>
  n.status === 'RUNNING' || n.children.some(containsRunning);

/** Split a node's children into singles and runs of ≥2 identical sibling subtrees. */
export type Group =
  | { kind: 'single'; node: TNode }
  | { kind: 'loop'; nodes: TNode[] };

export function groupChildren(children: TNode[]): Group[] {
  const groups: Group[] = [];
  let i = 0;
  while (i < children.length) {
    const c = children[i];
    if (c.children.length) {
      const s = sig(c);
      let j = i + 1;
      while (j < children.length && children[j].children.length && sig(children[j]) === s) j++;
      if (j - i >= 2) { groups.push({ kind: 'loop', nodes: children.slice(i, j) }); i = j; continue; }
    }
    groups.push({ kind: 'single', node: c });
    i++;
  }
  return groups;
}

/** Current iteration of a loop: the running one, else the first not-yet-done,
 *  else the last (everything finished). */
export function activeIteration(nodes: TNode[]): TNode {
  return nodes.find(containsRunning) ?? nodes.find((n) => n.status !== 'SUCCESS') ?? nodes[nodes.length - 1];
}
