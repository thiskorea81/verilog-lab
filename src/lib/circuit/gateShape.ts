import type { CircuitNode } from "./types";
import { nodeHeight, nodeWidth, pinOffset } from "./geometry";
import { pinSpecOf } from "./types";

export interface GateShape {
  bodyPath: string;
  extraPath?: string; // XOR의 추가 곡선
  bubble: boolean; // 출력 반전 버블(NAND/NOR/XNOR/NOT)
  bubbleCx: number;
  bubbleCy: number;
}

/** 게이트 몸체의 로컬 SVG path(노드 좌표 기준)를 계산한다. IEEE 표준 게이트 심볼과 유사한 형태. */
export function computeGateShape(node: CircuitNode): GateShape {
  const h = nodeHeight(node);
  const w = nodeWidth(node);
  const bodyLeft = 6;
  const bodyRight = w - 18;
  const yMid = h / 2;
  const bubble = node.kind === "nand" || node.kind === "nor" || node.kind === "xnor" || node.kind === "not";

  if (node.kind === "and" || node.kind === "nand") {
    const bw = bodyRight - bodyLeft;
    const rx = h / 2;
    const flatX = bodyLeft + Math.max(bw - rx, bw * 0.5);
    const path =
      `M ${bodyLeft},4 L ${flatX},4 A ${rx},${rx} 0 0 1 ${flatX},${h - 4} L ${bodyLeft},${h - 4} Z`;
    return { bodyPath: path, bubble, bubbleCx: flatX + rx, bubbleCy: yMid };
  }

  if (node.kind === "or" || node.kind === "nor" || node.kind === "xor" || node.kind === "xnor") {
    const s = h / 30 || 1;
    const tipX = bodyLeft + 55 * s;
    const c1 = bodyLeft + 34 * s;
    const c2 = bodyLeft + 14 * s;
    const path =
      `M ${bodyLeft},4 Q ${c1},4 ${tipX},${yMid} Q ${c1},${h - 4} ${bodyLeft},${h - 4} ` +
      `Q ${c2},${yMid} ${bodyLeft},4 Z`;
    let extraPath: string | undefined;
    if (node.kind === "xor" || node.kind === "xnor") {
      const xb = bodyLeft - 7 * s;
      const xc = bodyLeft + 12 * s;
      extraPath = `M ${xb},4 Q ${xc},${yMid} ${xb},${h - 4}`;
    }
    return { bodyPath: path, extraPath, bubble, bubbleCx: tipX, bubbleCy: yMid };
  }

  // not / buf
  const tipX = bodyRight;
  const path = `M ${bodyLeft},${yMid - 20} L ${tipX},${yMid} L ${bodyLeft},${yMid + 20} Z`;
  return { bodyPath: path, bubble, bubbleCx: tipX + 6, bubbleCy: yMid };
}

export function outputPinLocalPos(node: CircuitNode): { x: number; y: number } {
  const spec = pinSpecOf(node);
  const outPin = spec.outputs[0];
  return outPin ? pinOffset(node, outPin) : { x: nodeWidth(node), y: nodeHeight(node) / 2 };
}
