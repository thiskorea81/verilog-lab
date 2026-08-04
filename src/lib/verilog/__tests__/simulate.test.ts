import { describe, it, expect } from "vitest";
import { parseVerilog } from "../parser";
import { compile, Simulation } from "../simulate";
import type { Bit } from "../bits";

function b(...vals: (0 | 1)[]): Bit[] {
  return vals;
}

describe("Simulation - combinational", () => {
  it("simulates a basic AND gate via assign", () => {
    const m = parseVerilog(`
      module and_gate(a, b, y);
        input a, b;
        output y;
        assign y = a & b;
      endmodule
    `);
    const sim = new Simulation(compile(m));
    sim.initialize();
    for (const [a, bb, expected] of [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] as const) {
      sim.setInput("a", b(a));
      sim.setInput("b", b(bb));
      expect(sim.get("y")).toEqual(b(expected));
    }
  });

  it("simulates NAND-only XOR (2단원 대단원평가 7번 회로)", () => {
    const m = parseVerilog(`
      module xor_from_nand(a, b, y);
        input a, b;
        output y;
        wire n1, n2, n3;
        nand g1(n1, a, b);
        nand g2(n2, a, n1);
        nand g3(n3, n1, b);
        nand g4(y, n2, n3);
      endmodule
    `);
    const sim = new Simulation(compile(m));
    sim.initialize();
    for (const [a, bb] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      sim.setInput("a", b(a));
      sim.setInput("b", b(bb));
      expect(sim.get("y")).toEqual(b((a ^ bb) as 0 | 1));
    }
  });

  it("simulates a 4:1 mux via case statement", () => {
    const m = parseVerilog(`
      module mux4(sel, d0, d1, d2, d3, y);
        input [1:0] sel;
        input d0, d1, d2, d3;
        output reg y;
        always @(*) begin
          case (sel)
            2'b00: y = d0;
            2'b01: y = d1;
            2'b10: y = d2;
            default: y = d3;
          endcase
        end
      endmodule
    `);
    const sim = new Simulation(compile(m));
    sim.setInput("d0", b(1));
    sim.setInput("d1", b(0));
    sim.setInput("d2", b(1));
    sim.setInput("d3", b(0));
    sim.initialize();

    sim.setInput("sel", b(0, 0));
    expect(sim.get("y")).toEqual(b(1)); // d0

    sim.setInput("sel", b(0, 1));
    expect(sim.get("y")).toEqual(b(0)); // d1

    sim.setInput("sel", b(1, 0));
    expect(sim.get("y")).toEqual(b(1)); // d2

    sim.setInput("sel", b(1, 1));
    expect(sim.get("y")).toEqual(b(0)); // d3
  });

  it("half adder: sum=xor, carry=and", () => {
    const m = parseVerilog(`
      module half_adder(a, b, sum, cout);
        input a, b;
        output sum, cout;
        assign sum = a ^ b;
        assign cout = a & b;
      endmodule
    `);
    const sim = new Simulation(compile(m));
    sim.initialize();
    for (const [a, bb] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
      sim.setInput("a", b(a));
      sim.setInput("b", b(bb));
      expect(sim.get("sum")).toEqual(b((a ^ bb) as 0 | 1));
      expect(sim.get("cout")).toEqual(b((a & bb) as 0 | 1));
    }
  });
});

describe("Simulation - sequential", () => {
  it("D flip-flop with async reset (posedge clk or posedge rst)", () => {
    const m = parseVerilog(`
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
    `);
    const sim = new Simulation(compile(m));
    sim.setInput("clk", b(0));
    sim.setInput("rst", b(0));
    sim.setInput("d", b(1));
    sim.initialize();

    // no clock edge yet -> q remains x (uninitialized) until first event
    sim.setInput("rst", b(1)); // async reset asserted (posedge rst) -> q <= 0
    expect(sim.get("q")).toEqual(b(0));

    sim.setInput("rst", b(0));
    sim.setInput("d", b(1));
    // rising clock edge should capture d=1
    sim.setInput("clk", b(1));
    expect(sim.get("q")).toEqual(b(1));

    // falling edge should NOT change q
    sim.setInput("clk", b(0));
    expect(sim.get("q")).toEqual(b(1));

    // change d while clk low -> q should not change yet
    sim.setInput("d", b(0));
    expect(sim.get("q")).toEqual(b(1));

    // rising edge captures new d=0
    sim.setInput("clk", b(1));
    expect(sim.get("q")).toEqual(b(0));
  });

  it("toggle flip-flop (T-FF) built from D-FF feedback: q <= ~q on every posedge", () => {
    const m = parseVerilog(`
      module tff(clk, rst, q);
        input clk, rst;
        output reg q;
        always @(posedge clk or posedge rst) begin
          if (rst) q <= 1'b0;
          else q <= ~q;
        end
      endmodule
    `);
    const sim = new Simulation(compile(m));
    sim.setInput("rst", b(1));
    sim.setInput("clk", b(0));
    sim.initialize();
    expect(sim.get("q")).toEqual(b(0));
    sim.setInput("rst", b(0));

    const expected = [1, 0, 1, 0, 1];
    for (const exp of expected) {
      sim.setInput("clk", b(1));
      expect(sim.get("q")).toEqual(b(exp as 0 | 1));
      sim.setInput("clk", b(0));
    }
  });

  it("2-bit synchronous counter (wraps 3 -> 0)", () => {
    const m = parseVerilog(`
      module counter2(clk, rst, count);
        input clk, rst;
        output reg [1:0] count;
        always @(posedge clk or posedge rst) begin
          if (rst) count <= 2'b00;
          else count <= count + 1;
        end
      endmodule
    `);
    const sim = new Simulation(compile(m));
    sim.setInput("rst", b(1));
    sim.setInput("clk", b(0));
    sim.initialize();
    expect(sim.get("count")).toEqual(b(0, 0));
    sim.setInput("rst", b(0));

    const expected: Array<[0 | 1, 0 | 1]> = [[0, 1], [1, 0], [1, 1], [0, 0], [0, 1]];
    for (const [hi, lo] of expected) {
      sim.setInput("clk", b(1));
      expect(sim.get("count")).toEqual(b(hi, lo));
      sim.setInput("clk", b(0));
    }
  });
});
