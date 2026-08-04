import type { CircuitGraph } from "./types";
import { nodeHeight } from "./geometry";

/** 위상 정렬 기반 레이어 배치: 입력=0열, 이후 노드는 소스 노드보다 한 열 뒤에 배치. */
export function layoutCircuit(graph: CircuitGraph) {
  const depth = new Map<string, number>();
  const incoming = new Map<string, string[]>(); // nodeId -> [sourceNodeId,...]
  for (const n of graph.nodes) incoming.set(n.id, []);
  for (const w of graph.wires) {
    incoming.get(w.to.nodeId)?.push(w.from.nodeId);
  }

  function computeDepth(nodeId: string, visiting = new Set<string>()): number {
    if (depth.has(nodeId)) return depth.get(nodeId)!;
    if (visiting.has(nodeId)) return 0; // 순환(피드백) 방지
    visiting.add(nodeId);
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return 0;
    if (node.kind === "input" || node.kind === "clock") {
      depth.set(nodeId, 0);
      return 0;
    }
    const srcs = incoming.get(nodeId) ?? [];
    // DFF의 clk/rst 입력은 배치 깊이 계산에서 제외(피드백 루프가 흔함)
    let maxD = 0;
    for (const s of srcs) {
      maxD = Math.max(maxD, computeDepth(s, visiting) + 1);
    }
    depth.set(nodeId, maxD);
    visiting.delete(nodeId);
    return maxD;
  }

  for (const n of graph.nodes) computeDepth(n.id);

  const maxDepth = Math.max(0, ...graph.nodes.map((n) => depth.get(n.id) ?? 0));
  for (const n of graph.nodes) {
    if (n.kind === "output") depth.set(n.id, maxDepth + 1);
  }

  const columns = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(n.id);
  }

  const COL_W = 150;
  const ROW_H = 90;
  for (const [d, ids] of columns) {
    ids.forEach((id, i) => {
      const node = graph.nodes.find((n) => n.id === id)!;
      node.x = 60 + d * COL_W;
      node.y = 40 + i * Math.max(ROW_H, nodeHeight(node) + 30);
    });
  }
}
