export interface Example {
  name: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    name: "AND 게이트",
    code: `module and_gate(a, b, y);
  input a, b;
  output y;
  assign y = a & b;
endmodule
`,
  },
  {
    name: "NAND로 만든 XOR",
    code: `module xor_from_nand(a, b, y);
  input a, b;
  output y;
  wire n1, n2, n3;
  nand g1(n1, a, b);
  nand g2(n2, a, n1);
  nand g3(n3, n1, b);
  nand g4(y, n2, n3);
endmodule
`,
  },
  {
    name: "반가산기",
    code: `module half_adder(a, b, sum, cout);
  input a, b;
  output sum, cout;
  assign sum = a ^ b;
  assign cout = a & b;
endmodule
`,
  },
  {
    name: "4:1 멀티플렉서",
    code: `module mux4(sel, d0, d1, d2, d3, y);
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
`,
  },
  {
    name: "D 플립플롭 (비동기 리셋)",
    code: `module dff(clk, rst, d, q);
  input clk, rst, d;
  output reg q;
  always @(posedge clk or posedge rst) begin
    if (rst)
      q <= 1'b0;
    else
      q <= d;
  end
endmodule
`,
  },
  {
    name: "토글 플립플롭",
    code: `module tff(clk, rst, q);
  input clk, rst;
  output reg q;
  always @(posedge clk or posedge rst) begin
    if (rst) q <= 1'b0;
    else q <= ~q;
  end
endmodule
`,
  },
  {
    name: "2비트 카운터",
    code: `module counter2(clk, rst, count);
  input clk, rst;
  output reg [1:0] count;
  always @(posedge clk or posedge rst) begin
    if (rst) count <= 2'b00;
    else count <= count + 1;
  end
endmodule
`,
  },
];
