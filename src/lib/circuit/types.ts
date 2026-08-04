// 회로도(그래프) 데이터 모델. 캔버스 에디터와 Verilog 변환기가 공유한다.

export type NodeKind =
  | "input" | "output" | "clock"
  | "and" | "or" | "not" | "nand" | "nor" | "xor" | "xnor" | "buf"
  | "dff" | "mux2";

export interface PinRef {
  nodeId: string;
  pin: string; // 노드별 핀 이름 (예: "a","b","y" / "d","clk","rst","q")
}

export interface CircuitNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  label: string; // 신호 이름(입출력) 또는 인스턴스 이름(게이트)
  inputCount?: number; // and/or/nand/nor/xor/xnor 의 입력 개수(기본 2)
}

export interface Wire {
  id: string;
  from: PinRef; // 출력 핀
  to: PinRef; // 입력 핀
}

export interface CircuitGraph {
  moduleName: string;
  nodes: CircuitNode[];
  wires: Wire[];
}

export function emptyCircuit(name = "top"): CircuitGraph {
  return { moduleName: name, nodes: [], wires: [] };
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// 노드 종류별 입력/출력 핀 정의
export interface PinSpec {
  inputs: string[];
  outputs: string[];
}

export function pinSpecOf(node: CircuitNode): PinSpec {
  switch (node.kind) {
    case "input":
      return { inputs: [], outputs: ["y"] };
    case "output":
      return { inputs: ["a"], outputs: [] };
    case "clock":
      return { inputs: [], outputs: ["y"] };
    case "not":
    case "buf":
      return { inputs: ["a"], outputs: ["y"] };
    case "dff":
      return { inputs: ["d", "clk", "rst"], outputs: ["q"] };
    case "mux2":
      return { inputs: ["a", "b", "sel"], outputs: ["y"] };
    case "and":
    case "or":
    case "nand":
    case "nor":
    case "xor":
    case "xnor": {
      const n = node.inputCount ?? 2;
      return { inputs: Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i)), outputs: ["y"] };
    }
    default:
      return { inputs: [], outputs: [] };
  }
}

export const GATE_KINDS: NodeKind[] = ["and", "or", "not", "nand", "nor", "xor", "xnor", "buf"];

export const PALETTE: { kind: NodeKind; label: string }[] = [
  { kind: "input", label: "입력" },
  { kind: "output", label: "출력" },
  { kind: "clock", label: "클록" },
  { kind: "and", label: "AND" },
  { kind: "or", label: "OR" },
  { kind: "not", label: "NOT" },
  { kind: "nand", label: "NAND" },
  { kind: "nor", label: "NOR" },
  { kind: "xor", label: "XOR" },
  { kind: "xnor", label: "XNOR" },
  { kind: "buf", label: "BUF" },
  { kind: "dff", label: "D 플립플롭" },
  { kind: "mux2", label: "2:1 MUX" },
];
