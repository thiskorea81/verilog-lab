import type { CircuitNode } from "./types";
import { pinSpecOf } from "./types";

export const PIN_SPACING = 24;
export const GATE_BODY_W = 46;

export function nodeHeight(node: CircuitNode): number {
  const spec = pinSpecOf(node);
  const n = Math.max(spec.inputs.length, 1);
  return Math.max((n - 1) * PIN_SPACING + 40, 40);
}

export function nodeWidth(node: CircuitNode): number {
  switch (node.kind) {
    case "input":
    case "output":
    case "clock":
      return 44;
    case "dff":
      return 72;
    case "mux2":
      return 60;
    default:
      return GATE_BODY_W + 24;
  }
}

/** 노드 로컬 좌표계에서 핀의 (x,y) 오프셋을 계산한다(노드의 x,y 기준 상대 좌표). */
export function pinOffset(node: CircuitNode, pin: string): { x: number; y: number } {
  const spec = pinSpecOf(node);
  const h = nodeHeight(node);
  const w = nodeWidth(node);
  const inIdx = spec.inputs.indexOf(pin);
  if (inIdx >= 0) {
    if (spec.inputs.length === 1) return { x: 0, y: h / 2 };
    const step = h / (spec.inputs.length + 1);
    return { x: 0, y: step * (inIdx + 1) };
  }
  const outIdx = spec.outputs.indexOf(pin);
  if (outIdx >= 0) {
    return { x: w, y: h / 2 };
  }
  return { x: 0, y: h / 2 };
}

export function absPinPos(node: CircuitNode, pin: string): { x: number; y: number } {
  const off = pinOffset(node, pin);
  return { x: node.x + off.x, y: node.y + off.y };
}
