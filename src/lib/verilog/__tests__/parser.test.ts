import { describe, it, expect } from "vitest";
import { parseVerilog } from "../parser";

describe("parseVerilog", () => {
  it("parses a simple combinational module", () => {
    const src = `
      module and_gate(a, b, y);
        input a, b;
        output y;
        assign y = a & b;
      endmodule
    `;
    const m = parseVerilog(src);
    expect(m.name).toBe("and_gate");
    expect(m.ports).toEqual(["a", "b", "y"]);
    expect(m.portDecls).toHaveLength(3);
    expect(m.items).toHaveLength(1);
    expect(m.items[0].type).toBe("assign");
  });

  it("parses gate primitive instances", () => {
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
    const m = parseVerilog(src);
    expect(m.items).toHaveLength(4);
    for (const item of m.items) {
      expect(item.type).toBe("gate");
    }
  });

  it("parses a D flip-flop with async reset", () => {
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
    const m = parseVerilog(src);
    expect(m.items).toHaveLength(1);
    const always = m.items[0];
    expect(always.type).toBe("always");
    if (always.type === "always") {
      expect(always.sensitivity).toEqual([
        { edge: "posedge", signal: "clk" },
        { edge: "posedge", signal: "rst" },
      ]);
    }
  });

  it("parses width declarations and bit-select", () => {
    const src = `
      module bus_test(a, y);
        input [3:0] a;
        output y;
        assign y = a[0] & a[3];
      endmodule
    `;
    const m = parseVerilog(src);
    const inputDecl = m.portDecls.find((p) => p.name === "a");
    expect(inputDecl?.width).toBe(4);
  });

  it("parses case statements", () => {
    const src = `
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
    `;
    const m = parseVerilog(src);
    const always = m.items[0];
    expect(always.type).toBe("always");
    if (always.type === "always" && always.body.type === "block") {
      const caseStmt = always.body.stmts[0];
      expect(caseStmt.type).toBe("case");
      if (caseStmt.type === "case") {
        expect(caseStmt.cases).toHaveLength(3);
        expect(caseStmt.defaultStmt).toBeDefined();
      }
    }
  });

  it("parses concatenation and replication", () => {
    const src = `
      module concat_test(a, b, y);
        input a, b;
        output [3:0] y;
        assign y = {a, b, {2{a}}};
      endmodule
    `;
    const m = parseVerilog(src);
    expect(m.items[0].type).toBe("assign");
    const rhs = (m.items[0] as { type: "assign"; rhs: unknown }).rhs as { type: string; items: unknown[] };
    expect(rhs.type).toBe("concat");
    expect(rhs.items).toHaveLength(3);
  });
});
