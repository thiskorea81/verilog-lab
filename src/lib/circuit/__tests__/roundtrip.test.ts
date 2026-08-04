import { describe, it, expect } from "vitest";
import { parseVerilog } from "../../verilog/parser";
import { compile, Simulation } from "../../verilog/simulate";
import { circuitToVerilog } from "../toVerilog";
import { circuitFromVerilog } from "../fromVerilog";
import type { CircuitGraph } from "../types";
import { newId } from "../types";
import type { Bit } from "../../verilog/bits";

function b(...vals: (0 | 1)[]): Bit[] {
  return vals;
}

function simulateGraph(graph: CircuitGraph) {
  const { code } = circuitToVerilog(graph);
  const m = parseVerilog(code);
  return { sim: new Simulation(compile(m)), code };
}

describe("circuit -> verilog", () => {
  it("converts a hand-built NAND XOR graph into working verilog", () => {
    const graph: CircuitGraph = { moduleName: "xor_from_nand", nodes: [], wires: [] };
    const a = { id: newId("n"), kind: "input" as const, x: 0, y: 0, label: "a" };
    const bIn = { id: newId("n"), kind: "input" as const, x: 0, y: 0, label: "b" };
    const g1 = { id: newId("n"), kind: "nand" as const, x: 0, y: 0, label: "g1", inputCount: 2 };
    const g2 = { id: newId("n"), kind: "nand" as const, x: 0, y: 0, label: "g2", inputCount: 2 };
    const g3 = { id: newId("n"), kind: "nand" as const, x: 0, y: 0, label: "g3", inputCount: 2 };
    const g4 = { id: newId("n"), kind: "nand" as const, x: 0, y: 0, label: "g4", inputCount: 2 };
    const y = { id: newId("n"), kind: "output" as const, x: 0, y: 0, label: "y" };
    graph.nodes = [a, bIn, g1, g2, g3, g4, y];
    graph.wires = [
      { id: newId("w"), from: { nodeId: a.id, pin: "y" }, to: { nodeId: g1.id, pin: "a" } },
      { id: newId("w"), from: { nodeId: bIn.id, pin: "y" }, to: { nodeId: g1.id, pin: "b" } },
      { id: newId("w"), from: { nodeId: a.id, pin: "y" }, to: { nodeId: g2.id, pin: "a" } },
      { id: newId("w"), from: { nodeId: g1.id, pin: "y" }, to: { nodeId: g2.id, pin: "b" } },
      { id: newId("w"), from: { nodeId: g1.id, pin: "y" }, to: { nodeId: g3.id, pin: "a" } },
      { id: newId("w"), from: { nodeId: bIn.id, pin: "y" }, to: { nodeId: g3.id, pin: "b" } },
      { id: newId("w"), from: { nodeId: g2.id, pin: "y" }, to: { nodeId: g4.id, pin: "a" } },
      { id: newId("w"), from: { nodeId: g3.id, pin: "y" }, to: { nodeId: g4.id, pin: "b" } },
      { id: newId("w"), from: { nodeId: g4.id, pin: "y" }, to: { nodeId: y.id, pin: "a" } },
    ];

    const { sim } = simulateGraph(graph);
    sim.initialize();
    for (const [av, bv] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      sim.setInput("a", b(av));
      sim.setInput("b", b(bv));
      expect(sim.get("y")).toEqual(b((av ^ bv) as 0 | 1));
    }
  });
});

describe("verilog -> circuit -> verilog round trip", () => {
  it("round-trips gate-level xor-from-nand and behaves identically", () => {
    const src = `
      module xor_from_nand(a, b, y);
        input a, b;
        output y;
        wire n1, n2, n3;
        nand g1(n1, a, b);
        nand g2(n2, a, n1);
        nand g3(n3, n1, b);
        nand g4(y, n2, n3);
      endmodule
    `;
    const m1 = parseVerilog(src);
    const { graph, warnings } = circuitFromVerilog(m1);
    expect(warnings).toEqual([]);
    expect(graph.nodes.filter((n) => n.kind === "nand")).toHaveLength(4);

    const { sim } = simulateGraph(graph);
    sim.initialize();
    for (const [av, bv] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      sim.setInput("a", b(av));
      sim.setInput("b", b(bv));
      expect(sim.get("y")).toEqual(b((av ^ bv) as 0 | 1));
    }
  });

  it("round-trips assign-based half adder (expression decomposition)", () => {
    const src = `
      module half_adder(a, b, sum, cout);
        input a, b;
        output sum, cout;
        assign sum = a ^ b;
        assign cout = a & b;
      endmodule
    `;
    const m1 = parseVerilog(src);
    const { graph, warnings } = circuitFromVerilog(m1);
    expect(warnings).toEqual([]);

    const { sim } = simulateGraph(graph);
    sim.initialize();
    for (const [av, bv] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      sim.setInput("a", b(av));
      sim.setInput("b", b(bv));
      expect(sim.get("sum")).toEqual(b((av ^ bv) as 0 | 1));
      expect(sim.get("cout")).toEqual(b((av & bv) as 0 | 1));
    }
  });

  it("round-trips a D flip-flop with async reset", () => {
    const src = `
      module dff(clk, rst, d, q);
        input clk, rst, d;
        output reg q;
        always @(posedge clk or posedge rst) begin
          if (rst)
            q <= 1'b0;
          else
            q <= d;
        end
      endmodule
    `;
    const m1 = parseVerilog(src);
    const { graph, warnings } = circuitFromVerilog(m1);
    expect(warnings).toEqual([]);
    expect(graph.nodes.filter((n) => n.kind === "dff")).toHaveLength(1);

    const { sim } = simulateGraph(graph);
    sim.setInput("clk", b(0));
    sim.setInput("rst", b(1));
    sim.setInput("d", b(1));
    sim.initialize();
    expect(sim.get("q")).toEqual(b(0));
    sim.setInput("rst", b(0));
    sim.setInput("clk", b(1));
    expect(sim.get("q")).toEqual(b(1));
  });
});
