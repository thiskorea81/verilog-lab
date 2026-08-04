import { tokenize, type Token } from "./tokenizer";
import type {
  ModuleDecl, PortDecl, NetDecl, ModuleItem, AssignStmt, GateInstance,
  AlwaysBlock, SensItem, SensEdge, Stmt, Expr, LValue, CaseArm, GateType,
} from "./ast";

export class ParseError extends Error {
  line: number;
  col: number;
  constructor(message: string, line: number, col: number) {
    super(`${message} (${line}행 ${col}열)`);
    this.line = line;
    this.col = col;
  }
}

const GATE_TYPES = new Set(["and", "or", "not", "nand", "nor", "xor", "xnor", "buf"]);

function parseNumberLiteral(raw: string, line: number, col: number): { width: number; bits: (0 | 1 | "x")[] } {
  const tickIdx = raw.indexOf("'");
  if (tickIdx === -1) {
    // unsized decimal literal
    const val = parseInt(raw, 10);
    if (Number.isNaN(val)) throw new ParseError(`잘못된 숫자 리터럴 '${raw}'`, line, col);
    const width = Math.max(1, val.toString(2).length);
    return { width, bits: toBits(val, width) };
  }
  const widthStr = raw.slice(0, tickIdx);
  const width = widthStr ? parseInt(widthStr, 10) : 32;
  let rest = raw.slice(tickIdx + 1);
  if (rest[0] === "s" || rest[0] === "S") rest = rest.slice(1);
  const base = rest[0].toLowerCase();
  const digits = rest.slice(1).replace(/_/g, "");
  if (/^[xX]+$/.test(digits)) {
    return { width, bits: Array(width).fill("x") };
  }
  let bits: (0 | 1 | "x")[] = [];
  if (base === "b") {
    for (const ch of digits) {
      if (ch === "x" || ch === "X" || ch === "z" || ch === "Z") bits.push("x");
      else if (ch === "0" || ch === "1") bits.push(ch === "1" ? 1 : 0);
      else throw new ParseError(`잘못된 2진수 자릿수 '${ch}'`, line, col);
    }
  } else if (base === "h") {
    for (const ch of digits) {
      if (ch === "x" || ch === "X" || ch === "z" || ch === "Z") {
        bits.push("x", "x", "x", "x");
        continue;
      }
      const v = parseInt(ch, 16);
      if (Number.isNaN(v)) throw new ParseError(`잘못된 16진수 자릿수 '${ch}'`, line, col);
      bits.push(...toBits(v, 4));
    }
  } else if (base === "d") {
    const v = parseInt(digits, 10);
    if (Number.isNaN(v)) throw new ParseError(`잘못된 10진수 '${digits}'`, line, col);
    bits = toBits(v, width);
  } else if (base === "o") {
    for (const ch of digits) {
      const v = parseInt(ch, 8);
      if (Number.isNaN(v)) throw new ParseError(`잘못된 8진수 자릿수 '${ch}'`, line, col);
      bits.push(...toBits(v, 3));
    }
  } else {
    throw new ParseError(`알 수 없는 진법 '${base}'`, line, col);
  }
  // pad/truncate to width (MSB..LSB order)
  if (bits.length < width) {
    const pad = bits[0] === "x" ? "x" : 0;
    bits = Array(width - bits.length).fill(pad).concat(bits);
  } else if (bits.length > width) {
    bits = bits.slice(bits.length - width);
  }
  return { width, bits };
}

function toBits(val: number, width: number): (0 | 1)[] {
  const bits: (0 | 1)[] = [];
  for (let b = width - 1; b >= 0; b--) {
    bits.push(((val >> b) & 1) as 0 | 1);
  }
  return bits;
}

class Parser {
  tokens: Token[];
  pos = 0;

  constructor(src: string) {
    this.tokens = tokenize(src);
  }

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  next(): Token {
    const t = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  err(message: string): never {
    const t = this.peek();
    throw new ParseError(message, t.line, t.col);
  }

  expectPunct(value: string): Token {
    const t = this.peek();
    if (t.type !== "punct" || t.value !== value) {
      this.err(`'${value}'이(가) 필요합니다 (실제: '${t.value || "EOF"}')`);
    }
    return this.next();
  }

  expectKeyword(value: string): Token {
    const t = this.peek();
    if (t.type !== "keyword" || t.value !== value) {
      this.err(`키워드 '${value}'이(가) 필요합니다 (실제: '${t.value || "EOF"}')`);
    }
    return this.next();
  }

  isPunct(value: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === "punct" && t.value === value;
  }

  isKeyword(value: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === "keyword" && t.value === value;
  }

  expectIdent(): string {
    const t = this.peek();
    if (t.type !== "ident") this.err(`식별자가 필요합니다 (실제: '${t.value || "EOF"}')`);
    return this.next().value;
  }

  // ---- top level ----
  parseModule(): ModuleDecl {
    this.expectKeyword("module");
    const name = this.expectIdent();
    const ports: string[] = [];
    this.expectPunct("(");
    if (!this.isPunct(")")) {
      ports.push(this.expectIdent());
      while (this.isPunct(",")) {
        this.next();
        ports.push(this.expectIdent());
      }
    }
    this.expectPunct(")");
    this.expectPunct(";");

    const portDecls: PortDecl[] = [];
    const nets: NetDecl[] = [];
    const items: ModuleItem[] = [];

    while (!this.isKeyword("endmodule")) {
      if (this.peek().type === "eof") this.err("'endmodule'을 찾지 못했습니다");
      if (this.isKeyword("input") || this.isKeyword("output")) {
        this.parseIoDecl(portDecls, nets);
      } else if (this.isKeyword("wire") || this.isKeyword("reg")) {
        this.parseNetDecl(nets);
      } else if (this.isKeyword("assign")) {
        items.push(this.parseAssign());
      } else if (this.isKeyword("always")) {
        items.push(this.parseAlways());
      } else if (this.peek().type === "ident" && GATE_TYPES.has(this.peek().value)) {
        items.push(this.parseGateInstance());
      } else if (this.peek().type === "keyword" && GATE_TYPES.has(this.peek().value)) {
        items.push(this.parseGateInstance());
      } else if (this.isKeyword("parameter")) {
        // 무시: parameter x = 1;
        while (!this.isPunct(";")) this.next();
        this.next();
      } else {
        this.err(`모듈 안에서 예상치 못한 토큰 '${this.peek().value}'`);
      }
    }
    this.next(); // endmodule

    return { name, ports, portDecls, nets, items };
  }

  parseWidth(): number {
    if (this.isPunct("[")) {
      this.next();
      const hi = this.parseIntLiteral();
      this.expectPunct(":");
      const lo = this.parseIntLiteral();
      this.expectPunct("]");
      return Math.abs(hi - lo) + 1;
    }
    return 1;
  }

  parseIntLiteral(): number {
    const t = this.peek();
    if (t.type !== "number") this.err("정수가 필요합니다");
    this.next();
    return parseInt(t.value, 10);
  }

  parseIoDecl(portDecls: PortDecl[], nets: NetDecl[]) {
    const kind = this.next().value as "input" | "output";
    let isReg = false;
    if (kind === "output" && this.isKeyword("reg")) {
      this.next();
      isReg = true;
    }
    const width = this.parseWidth();
    const names = [this.expectIdent()];
    while (this.isPunct(",")) {
      this.next();
      names.push(this.expectIdent());
    }
    this.expectPunct(";");
    for (const name of names) {
      portDecls.push({ kind, name, width, isReg });
      if (kind === "output" && isReg) {
        nets.push({ kind: "reg", name, width });
      } else {
        nets.push({ kind: "wire", name, width });
      }
    }
  }

  parseNetDecl(nets: NetDecl[]) {
    const kind = this.next().value as "wire" | "reg";
    const width = this.parseWidth();
    const names = [this.expectIdent()];
    while (this.isPunct(",")) {
      this.next();
      names.push(this.expectIdent());
    }
    this.expectPunct(";");
    for (const name of names) nets.push({ kind, name, width });
  }

  parseAssign(): AssignStmt {
    this.expectKeyword("assign");
    const lhs = this.parseLValue();
    this.expectPunct("=");
    const rhs = this.parseExpr();
    this.expectPunct(";");
    return { type: "assign", lhs, rhs };
  }

  parseGateInstance(): GateInstance {
    const gate = this.next().value as GateType;
    let instanceName = `${gate}_${this.pos}`;
    if (this.peek().type === "ident" && !this.isPunct("(", 1)) {
      // optional instance name before (
    }
    if (this.peek().type === "ident") {
      instanceName = this.next().value;
    }
    this.expectPunct("(");
    const args: LValue[] = [];
    const argExprs: Expr[] = [];
    // first arg is always the output lvalue; not/buf may have multiple outputs before inputs
    args.push(this.parseLValue());
    while (this.isPunct(",")) {
      this.next();
      argExprs.push(this.parseExpr());
    }
    this.expectPunct(")");
    this.expectPunct(";");

    let outputs: LValue[] = [args[0]];
    let inputs: Expr[] = argExprs;
    if (gate === "not" || gate === "buf") {
      // 마지막 인자가 입력, 나머지(첫 인자 포함)는 전부 출력
      const all = [args[0], ...argExprs.map(exprToLValueMaybe)];
      const last = argExprs[argExprs.length - 1];
      outputs = [args[0], ...argExprs.slice(0, -1).map(exprToLValueMaybe)].filter((x): x is LValue => x !== null);
      inputs = last ? [last] : [];
      void all;
    }
    return { type: "gate", gate, instanceName, outputs, inputs };
  }

  parseLValue(): LValue {
    const name = this.expectIdent();
    if (this.isPunct("[")) {
      this.next();
      const hi = this.parseIntLiteral();
      if (this.isPunct(":")) {
        this.next();
        const lo = this.parseIntLiteral();
        this.expectPunct("]");
        return { name, rangeSelect: [hi, lo] };
      }
      this.expectPunct("]");
      return { name, bitSelect: hi };
    }
    return { name };
  }

  parseAlways(): AlwaysBlock {
    this.expectKeyword("always");
    this.expectPunct("@");
    const sensitivity: SensItem[] = [];
    let isStar = false;
    this.expectPunct("(");
    if (this.isPunct("*")) {
      this.next();
      isStar = true;
    } else {
      sensitivity.push(this.parseSensItem());
      while (this.isKeyword("or") || this.isPunct(",")) {
        this.next();
        sensitivity.push(this.parseSensItem());
      }
    }
    this.expectPunct(")");
    const body = this.parseStmt();
    return { type: "always", sensitivity, isStar, body };
  }

  parseSensItem(): SensItem {
    let edge: SensEdge = "level";
    if (this.isKeyword("posedge")) {
      this.next();
      edge = "posedge";
    } else if (this.isKeyword("negedge")) {
      this.next();
      edge = "negedge";
    }
    const signal = this.expectIdent();
    return { edge, signal };
  }

  parseStmt(): Stmt {
    if (this.isKeyword("begin")) {
      this.next();
      const stmts: Stmt[] = [];
      while (!this.isKeyword("end")) {
        if (this.peek().type === "eof") this.err("'end'를 찾지 못했습니다");
        stmts.push(this.parseStmt());
      }
      this.next();
      return { type: "block", stmts };
    }
    if (this.isKeyword("if")) {
      this.next();
      this.expectPunct("(");
      const cond = this.parseExpr();
      this.expectPunct(")");
      const then = this.parseStmt();
      let elseStmt: Stmt | undefined;
      if (this.isKeyword("else")) {
        this.next();
        elseStmt = this.parseStmt();
      }
      return { type: "if", cond, then, else: elseStmt };
    }
    if (this.isKeyword("case")) {
      this.next();
      this.expectPunct("(");
      const subject = this.parseExpr();
      this.expectPunct(")");
      const cases: CaseArm[] = [];
      let defaultStmt: Stmt | undefined;
      while (!this.isKeyword("endcase")) {
        if (this.peek().type === "eof") this.err("'endcase'를 찾지 못했습니다");
        if (this.isKeyword("default")) {
          this.next();
          if (this.isPunct(":")) this.next();
          defaultStmt = this.parseStmt();
        } else {
          const values = [this.parseExpr()];
          while (this.isPunct(",")) {
            this.next();
            values.push(this.parseExpr());
          }
          this.expectPunct(":");
          const body = this.parseStmt();
          cases.push({ values, body });
        }
      }
      this.next(); // endcase
      return { type: "case", subject, cases, defaultStmt };
    }
    // assignment
    const lhs = this.parseLValue();
    let nonBlocking = false;
    if (this.isPunct("<=")) {
      nonBlocking = true;
      this.next();
    } else {
      this.expectPunct("=");
    }
    const rhs = this.parseExpr();
    this.expectPunct(";");
    return nonBlocking
      ? { type: "nonblockingAssign", lhs, rhs }
      : { type: "blockingAssign", lhs, rhs };
  }

  // ---- expressions (precedence climbing) ----
  parseExpr(): Expr {
    return this.parseTernary();
  }

  parseTernary(): Expr {
    const cond = this.parseLogicalOr();
    if (this.isPunct("?")) {
      this.next();
      const then = this.parseExpr();
      this.expectPunct(":");
      const elseE = this.parseExpr();
      return { type: "ternary", cond, then, else: elseE };
    }
    return cond;
  }

  parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.isPunct("||")) {
      this.next();
      left = { type: "binary", op: "||", left, right: this.parseLogicalAnd() };
    }
    return left;
  }

  parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.isPunct("&&")) {
      this.next();
      left = { type: "binary", op: "&&", left, right: this.parseEquality() };
    }
    return left;
  }

  parseEquality(): Expr {
    let left = this.parseBitOr();
    while (this.isPunct("==") || this.isPunct("!=")) {
      const op = this.next().value as "==" | "!=";
      left = { type: "binary", op, left, right: this.parseBitOr() };
    }
    return left;
  }

  parseBitOr(): Expr {
    let left = this.parseBitXor();
    while (this.isPunct("|") && !this.isPunct("||")) {
      this.next();
      left = { type: "binary", op: "|", left, right: this.parseBitXor() };
    }
    return left;
  }

  parseBitXor(): Expr {
    let left = this.parseBitAnd();
    while (this.isPunct("^") || this.isPunct("~^") || this.isPunct("^~")) {
      const isXnor = this.peek().value !== "^";
      this.next();
      left = { type: "binary", op: isXnor ? "~^" : "^", left, right: this.parseBitAnd() };
    }
    return left;
  }

  parseBitAnd(): Expr {
    let left = this.parseAdditive();
    while (this.isPunct("&") && !this.isPunct("&&")) {
      this.next();
      left = { type: "binary", op: "&", left, right: this.parseAdditive() };
    }
    return left;
  }

  parseAdditive(): Expr {
    let left = this.parseUnary();
    while (this.isPunct("+") || this.isPunct("-")) {
      const op = this.next().value as "+" | "-";
      left = { type: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary(): Expr {
    if (this.isPunct("~")) {
      this.next();
      return { type: "unary", op: "~", operand: this.parseUnary() };
    }
    if (this.isPunct("!")) {
      // logical not -> 1비트 결과의 ~ 로 근사 (교육용 부분집합)
      this.next();
      return { type: "unary", op: "~", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  parsePrimary(): Expr {
    if (this.isPunct("(")) {
      this.next();
      const e = this.parseExpr();
      this.expectPunct(")");
      return e;
    }
    if (this.isPunct("{")) {
      this.next();
      // could be replication {n{expr}} or concat {a,b,c}
      const first = this.parseExpr();
      if (this.isPunct("{")) {
        // first was the replication count, encoded as const expr
        this.next();
        const item = this.parseExpr();
        this.expectPunct("}");
        this.expectPunct("}");
        const count = constExprToInt(first);
        return { type: "replicate", count, item };
      }
      const items = [first];
      while (this.isPunct(",")) {
        this.next();
        items.push(this.parseExpr());
      }
      this.expectPunct("}");
      return { type: "concat", items };
    }
    const t = this.peek();
    if (t.type === "number") {
      this.next();
      const { width, bits } = parseNumberLiteral(t.value, t.line, t.col);
      return { type: "const", width, bits };
    }
    if (t.type === "ident") {
      this.next();
      if (this.isPunct("[")) {
        this.next();
        const hi = this.parseIntLiteral();
        if (this.isPunct(":")) {
          this.next();
          const lo = this.parseIntLiteral();
          this.expectPunct("]");
          return { type: "ident", name: t.value, rangeSelect: [hi, lo] };
        }
        this.expectPunct("]");
        return { type: "ident", name: t.value, bitSelect: hi };
      }
      return { type: "ident", name: t.value };
    }
    this.err(`식을 파싱할 수 없습니다 (토큰: '${t.value || "EOF"}')`);
  }
}

function exprToLValueMaybe(e: Expr): LValue | null {
  if (e.type === "ident") return { name: e.name, bitSelect: e.bitSelect, rangeSelect: e.rangeSelect };
  return null;
}

function constExprToInt(e: Expr): number {
  if (e.type === "const") {
    let v = 0;
    for (const b of e.bits) v = (v << 1) | (b === "x" ? 0 : b);
    return v;
  }
  throw new ParseError("반복 연산자의 개수는 상수여야 합니다", 0, 0);
}

export function parseVerilog(src: string): ModuleDecl {
  const p = new Parser(src);
  return p.parseModule();
}
