import { describe, it, expect } from "vitest";
import { parseVerilog } from "../parser";
import { compile } from "../simulate";
import { generateTruthTable, isCombinational, bitsToString } from "../truthTable";

describe("generateTruthTable", () => {
  it("enumerates all 4 rows for a 2-input xor", () => {
    const m = parseVerilog(`
      module xor_gate(a, b, y);
        input a, b;
        output y;
        assign y = a ^ b;
      endmodule
    `);
    const compiled = compile(m);
    expect(isCombinational(compiled)).toBe(true);
    const table = generateTruthTable(compiled);
    expect(table.rows).toHaveLength(4);
    for (const row of table.rows) {
      const a = row.inputs.a[0];
      const b = row.inputs.b[0];
      const y = row.outputs.y[0];
      expect(bitsToString(row.outputs.y)).toBe(String(Number(a) ^ Number(b)));
      void y;
    }
  });

  it("reports sequential modules as non-combinational", () => {
    const m = parseVerilog(`
      module dff(clk, d, q);
        input clk, d;
        output reg q;
        always @(posedge clk) q <= d;
      endmodule
    `);
    expect(isCombinational(compile(m))).toBe(false);
  });
});
