import type { CircuitGraph, CircuitNode, PinRef } from "./types";
import { GATE_KINDS } from "./types";

export interface ToVerilogResult {
  code: string;
  warnings: string[];
}

function findSource(graph: CircuitGraph, to: PinRef): PinRef | null {
  const w = graph.wires.find((w) => w.to.nodeId === to.nodeId && w.to.pin === to.pin);
  return w ? w.from : null;
}

/** 노드의 출력 핀이 실제로 회로에서 어떤 Verilog 신호 이름으로 불릴지 계산한다. */
function signalNameFor(node: CircuitNode, wireNames: Map<string, string>): string {
  if (node.kind === "input" || node.kind === "clock") return node.label;
  return wireNames.get(node.id) ?? node.id;
}

export function circuitToVerilog(graph: CircuitGraph): ToVerilogResult {
  const warnings: string[] = [];
  const inputs = graph.nodes.filter((n) => n.kind === "input" || n.kind === "clock");
  const outputs = graph.nodes.filter((n) => n.kind === "output");
  const internal = graph.nodes.filter((n) => n.kind !== "input" && n.kind !== "output" && n.kind !== "clock");

  const wireNames = new Map<string, string>();
  const dffOutputs = new Set<string>();
  let wCounter = 1;
  for (const node of internal) {
    const name = `w${wCounter++}`;
    wireNames.set(node.id, name);
    if (node.kind === "dff") dffOutputs.add(name);
  }

  function sourceSignal(to: PinRef): string {
    const src = findSource(graph, to);
    if (!src) {
      warnings.push(`'${to.nodeId}'의 '${to.pin}' 입력이 연결되어 있지 않습니다 (0으로 처리).`);
      return "1'b0";
    }
    const srcNode = graph.nodes.find((n) => n.id === src.nodeId)!;
    return signalNameFor(srcNode, wireNames);
  }

  const lines: string[] = [];
  const portNames = [...inputs.map((n) => n.label), ...outputs.map((n) => n.label)];
  lines.push(`module ${graph.moduleName || "top"}(${portNames.join(", ")});`);
  for (const n of inputs) lines.push(`  input ${n.label};`);
  for (const n of outputs) lines.push(`  output ${n.label};`);
  lines.push("");

  const wireDecls = internal.filter((n) => !dffOutputs.has(wireNames.get(n.id)!));
  const regDecls = internal.filter((n) => dffOutputs.has(wireNames.get(n.id)!));
  for (const n of wireDecls) lines.push(`  wire ${wireNames.get(n.id)};`);
  for (const n of regDecls) lines.push(`  reg ${wireNames.get(n.id)};`);
  if (wireDecls.length || regDecls.length) lines.push("");

  for (const node of internal) {
    const outName = wireNames.get(node.id)!;
    if (GATE_KINDS.includes(node.kind)) {
      const spec = node.kind === "not" || node.kind === "buf" ? ["a"] : Array.from(
        { length: node.inputCount ?? 2 },
        (_, i) => String.fromCharCode(97 + i)
      );
      const args = spec.map((pin) => sourceSignal({ nodeId: node.id, pin }));
      lines.push(`  ${node.kind} ${node.id}(${outName}, ${args.join(", ")});`);
    } else if (node.kind === "dff") {
      const d = sourceSignal({ nodeId: node.id, pin: "d" });
      const clk = sourceSignal({ nodeId: node.id, pin: "clk" });
      const rstSrc = findSource(graph, { nodeId: node.id, pin: "rst" });
      if (rstSrc) {
        const rst = sourceSignal({ nodeId: node.id, pin: "rst" });
        lines.push(`  always @(posedge ${clk} or posedge ${rst}) begin`);
        lines.push(`    if (${rst}) ${outName} <= 1'b0;`);
        lines.push(`    else ${outName} <= ${d};`);
        lines.push(`  end`);
      } else {
        lines.push(`  always @(posedge ${clk}) begin`);
        lines.push(`    ${outName} <= ${d};`);
        lines.push(`  end`);
      }
    } else if (node.kind === "mux2") {
      const a = sourceSignal({ nodeId: node.id, pin: "a" });
      const b = sourceSignal({ nodeId: node.id, pin: "b" });
      const sel = sourceSignal({ nodeId: node.id, pin: "sel" });
      lines.push(`  assign ${outName} = ${sel} ? ${b} : ${a};`);
    }
  }
  if (internal.length) lines.push("");

  for (const n of outputs) {
    const src = sourceSignal({ nodeId: n.id, pin: "a" });
    lines.push(`  assign ${n.label} = ${src};`);
  }

  lines.push("endmodule");
  return { code: lines.join("\n"), warnings };
}
