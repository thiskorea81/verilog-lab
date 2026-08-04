// Verilog(교육용 부분집합) AST 타입 정의.
// 지원 범위: module/input/output/wire/reg, assign, 게이트 프리미티브 인스턴스,
// always @(posedge/negedge/*) 블록(if/case, blocking/nonblocking 대입).
// 지원하지 않음: function/task, generate, parameter(선언은 무시), initial, for/while, tri-state(z).

export type GateType = "and" | "or" | "not" | "nand" | "nor" | "xor" | "xnor" | "buf";

export interface PortDecl {
  kind: "input" | "output";
  name: string;
  width: number; // 1 = 스칼라
  isReg: boolean; // output reg 여부 (input reg는 없음)
}

export interface NetDecl {
  kind: "wire" | "reg";
  name: string;
  width: number;
}

export interface AssignStmt {
  type: "assign";
  lhs: LValue;
  rhs: Expr;
}

export interface GateInstance {
  type: "gate";
  gate: GateType;
  instanceName: string;
  outputs: LValue[]; // not/buf는 여러 출력 허용, 나머지는 보통 1개
  inputs: Expr[];
}

export type SensEdge = "posedge" | "negedge" | "level"; // level = always @(*) 또는 @(a or b)

export interface SensItem {
  edge: SensEdge;
  signal: string;
}

export interface AlwaysBlock {
  type: "always";
  sensitivity: SensItem[];
  isStar: boolean; // always @(*)
  body: Stmt;
}

export type ModuleItem = AssignStmt | GateInstance | AlwaysBlock;

export interface LValue {
  name: string;
  bitSelect?: number; // sig[2]
  rangeSelect?: [number, number]; // sig[3:1] -> [3,1]
}

// ---- expressions ----
export type Expr =
  | { type: "const"; width: number; bits: (0 | 1 | "x")[] } // MSB..LSB
  | { type: "ident"; name: string; bitSelect?: number; rangeSelect?: [number, number] }
  | { type: "unary"; op: "~" | "&" | "|" | "^"; operand: Expr }
  | { type: "binary"; op: "&" | "|" | "^" | "~^" | "==" | "!=" | "&&" | "||" | "+" | "-"; left: Expr; right: Expr }
  | { type: "ternary"; cond: Expr; then: Expr; else: Expr }
  | { type: "concat"; items: Expr[] }
  | { type: "replicate"; count: number; item: Expr };

// ---- statements (always block bodies) ----
export type Stmt =
  | { type: "block"; stmts: Stmt[] }
  | { type: "blockingAssign"; lhs: LValue; rhs: Expr }
  | { type: "nonblockingAssign"; lhs: LValue; rhs: Expr }
  | { type: "if"; cond: Expr; then: Stmt; else?: Stmt }
  | { type: "case"; subject: Expr; cases: CaseArm[]; defaultStmt?: Stmt };

export interface CaseArm {
  values: Expr[]; // 여러 값을 콤마로 묶을 수 있음 (2'b00, 2'b01: ...)
  body: Stmt;
}

export interface ModuleDecl {
  name: string;
  ports: string[]; // 포트 목록(선언 순서)
  portDecls: PortDecl[];
  nets: NetDecl[];
  items: ModuleItem[];
}

export interface ParseError {
  message: string;
  line: number;
  col: number;
}
