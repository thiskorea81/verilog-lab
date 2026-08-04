import type {
  ModuleDecl, Expr, Stmt, LValue, AssignStmt, GateInstance, AlwaysBlock, SensItem,
} from "./ast";
import {
  type Bit, extendTo, xs, bitAnd, bitOr, bitXor, bitXnor, bitNot, bitAdd, bitSub,
  toUnsigned, fromUnsigned, bitsEqual,
} from "./bits";

export interface SignalInfo {
  name: string;
  width: number;
  isInput: boolean;
  isOutput: boolean;
  isReg: boolean;
}

export interface SimEvent {
  kind: "combSettleFailed" | "clockEdge";
  detail: string;
}

const MAX_SETTLE_ITERATIONS = 1000;

export class SimulationError extends Error {}

interface CombDriver {
  target: LValue;
  eval: (get: (name: string) => Bit[]) => Bit[];
}

interface ClockedBlock {
  block: AlwaysBlock;
  edgeSignals: SensItem[]; // posedge/negedge entries only
}

interface LevelBlock {
  block: AlwaysBlock;
  deps: string[];
}

export class CompiledCircuit {
  module: ModuleDecl;
  signals = new Map<string, SignalInfo>();
  combDrivers: CombDriver[] = [];
  clockedBlocks: ClockedBlock[] = [];
  levelBlocks: LevelBlock[] = [];

  constructor(module: ModuleDecl) {
    this.module = module;
    for (const net of module.nets) {
      const portDecl = module.portDecls.find((p) => p.name === net.name);
      this.signals.set(net.name, {
        name: net.name,
        width: net.width,
        isInput: portDecl?.kind === "input",
        isOutput: portDecl?.kind === "output",
        isReg: net.kind === "reg",
      });
    }

    for (const item of module.items) {
      if (item.type === "assign") {
        this.combDrivers.push(compileAssign(item));
      } else if (item.type === "gate") {
        this.combDrivers.push(...compileGate(item));
      } else if (item.type === "always") {
        const edgeSignals = item.sensitivity.filter((s) => s.edge !== "level");
        if (item.isStar || edgeSignals.length === 0) {
          this.levelBlocks.push({ block: item, deps: collectDeps(item.body) });
        } else {
          this.clockedBlocks.push({ block: item, edgeSignals });
        }
      }
    }
  }

  widthOf(name: string): number {
    return this.signals.get(name)?.width ?? 1;
  }
}

function compileAssign(item: AssignStmt): CombDriver {
  return {
    target: item.lhs,
    eval: (get) => evalExpr(item.rhs, get),
  };
}

function compileGate(item: GateInstance): CombDriver[] {
  const { gate, inputs, outputs } = item;
  const combine = (get: (name: string) => Bit[]): Bit => {
    const vals = inputs.map((e) => reduceToScalar(evalExpr(e, get)));
    switch (gate) {
      case "and":
        return vals.reduce((a, b) => scalarAnd(a, b));
      case "or":
        return vals.reduce((a, b) => scalarOr(a, b));
      case "nand":
        return scalarNot(vals.reduce((a, b) => scalarAnd(a, b)));
      case "nor":
        return scalarNot(vals.reduce((a, b) => scalarOr(a, b)));
      case "xor":
        return vals.reduce((a, b) => scalarXor(a, b));
      case "xnor":
        return scalarNot(vals.reduce((a, b) => scalarXor(a, b)));
      case "not":
      case "buf":
        return vals[0] ?? "x";
      default:
        return "x";
    }
  };
  const finalCombine = gate === "not" ? (get: (n: string) => Bit[]) => scalarNot(combine(get)) : combine;
  return outputs.map((out) => ({
    target: out,
    eval: (get) => [finalCombine(get)],
  }));
}

function reduceToScalar(bits: Bit[]): Bit {
  if (bits.length === 1) return bits[0];
  // 다중 비트가 게이트에 들어오면 OR 축약(교육용 단순화)
  return bits.some((b) => b === 1) ? 1 : bits.some((b) => b === "x") ? "x" : 0;
}
function scalarAnd(a: Bit, b: Bit): Bit {
  if (a === 0 || b === 0) return 0;
  if (a === "x" || b === "x") return "x";
  return 1;
}
function scalarOr(a: Bit, b: Bit): Bit {
  if (a === 1 || b === 1) return 1;
  if (a === "x" || b === "x") return "x";
  return 0;
}
function scalarXor(a: Bit, b: Bit): Bit {
  if (a === "x" || b === "x") return "x";
  return (a ^ b) as Bit;
}
function scalarNot(a: Bit): Bit {
  return a === "x" ? "x" : a === 0 ? 1 : 0;
}

function collectDeps(stmt: Stmt): string[] {
  const deps = new Set<string>();
  function visitExpr(e: Expr) {
    switch (e.type) {
      case "ident":
        deps.add(e.name);
        break;
      case "unary":
        visitExpr(e.operand);
        break;
      case "binary":
        visitExpr(e.left);
        visitExpr(e.right);
        break;
      case "ternary":
        visitExpr(e.cond);
        visitExpr(e.then);
        visitExpr(e.else);
        break;
      case "concat":
        e.items.forEach(visitExpr);
        break;
      case "replicate":
        visitExpr(e.item);
        break;
    }
  }
  function visitStmt(s: Stmt) {
    switch (s.type) {
      case "block":
        s.stmts.forEach(visitStmt);
        break;
      case "blockingAssign":
      case "nonblockingAssign":
        visitExpr(s.rhs);
        break;
      case "if":
        visitExpr(s.cond);
        visitStmt(s.then);
        if (s.else) visitStmt(s.else);
        break;
      case "case":
        visitExpr(s.subject);
        s.cases.forEach((c) => {
          c.values.forEach(visitExpr);
          visitStmt(c.body);
        });
        if (s.defaultStmt) visitStmt(s.defaultStmt);
        break;
    }
  }
  visitStmt(stmt);
  return [...deps];
}

// ---- expression evaluation ----
export function evalExpr(e: Expr, get: (name: string) => Bit[]): Bit[] {
  switch (e.type) {
    case "const":
      return e.bits;
    case "ident": {
      const full = get(e.name);
      if (e.bitSelect !== undefined) {
        const idx = full.length - 1 - e.bitSelect;
        return [full[idx] ?? "x"];
      }
      if (e.rangeSelect) {
        const [hi, lo] = e.rangeSelect;
        const start = full.length - 1 - hi;
        const end = full.length - 1 - lo;
        return full.slice(Math.min(start, end), Math.max(start, end) + 1);
      }
      return full;
    }
    case "unary": {
      const v = evalExpr(e.operand, get);
      if (e.op === "~") return bitNot(v);
      if (e.op === "&") return [reduceAndAll(v)];
      if (e.op === "|") return [reduceOrAll(v)];
      return [reduceXorAll(v)];
    }
    case "binary": {
      const l = evalExpr(e.left, get);
      const r = evalExpr(e.right, get);
      switch (e.op) {
        case "&":
          return bitAnd(l, r);
        case "|":
          return bitOr(l, r);
        case "^":
          return bitXor(l, r);
        case "~^":
          return bitXnor(l, r);
        case "+":
          return bitAdd(l, r);
        case "-":
          return bitSub(l, r);
        case "&&":
          return [scalarAnd(reduceOrAll(l), reduceOrAll(r))];
        case "||":
          return [scalarOr(reduceOrAll(l), reduceOrAll(r))];
        case "==": {
          const w = Math.max(l.length, r.length);
          const le = extendTo(l, w);
          const re = extendTo(r, w);
          if (le.some((b) => b === "x") || re.some((b) => b === "x")) return ["x"];
          return [bitsEqual(le, re) ? 1 : 0];
        }
        case "!=": {
          const w = Math.max(l.length, r.length);
          const le = extendTo(l, w);
          const re = extendTo(r, w);
          if (le.some((b) => b === "x") || re.some((b) => b === "x")) return ["x"];
          return [bitsEqual(le, re) ? 0 : 1];
        }
      }
      return ["x"];
    }
    case "ternary": {
      const c = evalExpr(e.cond, get);
      const cv = reduceOrAll(c);
      if (cv === "x") {
        const t = evalExpr(e.then, get);
        const f = evalExpr(e.else, get);
        const w = Math.max(t.length, f.length);
        return xs(w);
      }
      return cv === 1 ? evalExpr(e.then, get) : evalExpr(e.else, get);
    }
    case "concat":
      return e.items.flatMap((item) => evalExpr(item, get));
    case "replicate": {
      const v = evalExpr(e.item, get);
      const out: Bit[] = [];
      for (let i = 0; i < e.count; i++) out.push(...v);
      return out;
    }
  }
}

function reduceAndAll(a: Bit[]): Bit {
  if (a.some((b) => b === 0)) return 0;
  if (a.some((b) => b === "x")) return "x";
  return 1;
}
function reduceOrAll(a: Bit[]): Bit {
  if (a.some((b) => b === 1)) return 1;
  if (a.some((b) => b === "x")) return "x";
  return 0;
}
function reduceXorAll(a: Bit[]): Bit {
  let v = 0;
  for (const b of a) {
    if (b === "x") return "x";
    v ^= b;
  }
  return v as Bit;
}

// ---- statement execution (for always blocks) ----
interface ExecContext {
  scratch: Map<string, Bit[]>; // 블로킹 대입이 즉시 반영되는 임시 값
  nba: Array<{ target: LValue; value: Bit[] }>; // 논블로킹 대입은 블록이 끝난 뒤 일괄 적용
  widthOf: (name: string) => number;
}

function getScratch(ctx: ExecContext, name: string): Bit[] {
  return ctx.scratch.get(name) ?? xs(ctx.widthOf(name));
}

function applyLValue(ctx: ExecContext, lhs: LValue, value: Bit[], nonBlocking: boolean) {
  const width = ctx.widthOf(lhs.name);
  if (lhs.bitSelect === undefined && !lhs.rangeSelect) {
    const v = extendTo(value, width);
    if (nonBlocking) ctx.nba.push({ target: lhs, value: v });
    else ctx.scratch.set(lhs.name, v);
    return;
  }
  const full = [...getScratch(ctx, lhs.name)];
  if (lhs.bitSelect !== undefined) {
    const idx = full.length - 1 - lhs.bitSelect;
    full[idx] = value[value.length - 1] ?? "x";
  } else if (lhs.rangeSelect) {
    const [hi, lo] = lhs.rangeSelect;
    const start = full.length - 1 - hi;
    const end = full.length - 1 - lo;
    const lo2 = Math.min(start, end);
    const seg = extendTo(value, Math.abs(hi - lo) + 1);
    for (let i = 0; i < seg.length; i++) full[lo2 + i] = seg[i];
  }
  if (nonBlocking) ctx.nba.push({ target: { name: lhs.name }, value: full });
  else ctx.scratch.set(lhs.name, full);
}

function execStmt(stmt: Stmt, ctx: ExecContext) {
  switch (stmt.type) {
    case "block":
      for (const s of stmt.stmts) execStmt(s, ctx);
      break;
    case "blockingAssign": {
      const v = evalExpr(stmt.rhs, (n) => getScratch(ctx, n));
      applyLValue(ctx, stmt.lhs, v, false);
      break;
    }
    case "nonblockingAssign": {
      const v = evalExpr(stmt.rhs, (n) => getScratch(ctx, n));
      applyLValue(ctx, stmt.lhs, v, true);
      break;
    }
    case "if": {
      const c = evalExpr(stmt.cond, (n) => getScratch(ctx, n));
      const cv = reduceOrAll(c);
      if (cv === 1) execStmt(stmt.then, ctx);
      else if (cv === 0 && stmt.else) execStmt(stmt.else, ctx);
      // cv === 'x' 인 경우 교육용 단순화를 위해 아무 분기도 taken 하지 않음
      break;
    }
    case "case": {
      const subj = evalExpr(stmt.subject, (n) => getScratch(ctx, n));
      let matched = false;
      for (const arm of stmt.cases) {
        for (const valExpr of arm.values) {
          const val = evalExpr(valExpr, (n) => getScratch(ctx, n));
          const w = Math.max(subj.length, val.length);
          if (bitsEqual(extendTo(subj, w), extendTo(val, w))) {
            execStmt(arm.body, ctx);
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (!matched && stmt.defaultStmt) execStmt(stmt.defaultStmt, ctx);
      break;
    }
  }
}

// ---- top-level simulation ----
export class Simulation {
  compiled: CompiledCircuit;
  values = new Map<string, Bit[]>();
  events: SimEvent[] = [];

  constructor(compiled: CompiledCircuit) {
    this.compiled = compiled;
    for (const [name, info] of compiled.signals) {
      this.values.set(name, xs(info.width));
    }
  }

  get(name: string): Bit[] {
    return this.values.get(name) ?? [];
  }

  private getFn = (name: string): Bit[] => this.get(name);

  /** 입력 신호 값을 설정하고, 엣지 감지 -> 클록 블록 실행 -> 조합논리 안정화를 수행한다. */
  setInput(name: string, value: Bit[]) {
    const info = this.compiled.signals.get(name);
    if (!info) throw new SimulationError(`알 수 없는 신호 '${name}'`);
    const old = this.get(name);
    const width = info.width;
    const v = extendTo(value, width);
    this.values.set(name, v);
    this.runClockedBlocksForTransition(name, old[old.length - 1], v[v.length - 1]);
    this.settleCombinational();
  }

  /** 초기화: 모든 always 블록을 한 번 확인하고(리셋 등 초깃값 없이), 조합논리를 안정화한다. */
  initialize() {
    this.settleCombinational();
  }

  private runClockedBlocksForTransition(signalName: string, oldBit: Bit, newBit: Bit) {
    const isPos = oldBit !== 1 && newBit === 1;
    const isNeg = oldBit !== 0 && newBit === 0;
    const triggered = this.compiled.clockedBlocks.filter((cb) =>
      cb.edgeSignals.some(
        (s) => s.signal === signalName && ((s.edge === "posedge" && isPos) || (s.edge === "negedge" && isNeg))
      )
    );
    if (triggered.length === 0) return;

    const allNba: Array<{ target: LValue; value: Bit[] }> = [];
    for (const cb of triggered) {
      const ctx: ExecContext = {
        scratch: new Map(this.values),
        nba: [],
        widthOf: (n) => this.compiled.widthOf(n),
      };
      execStmt(cb.block.body, ctx);
      allNba.push(...ctx.nba);
    }
    for (const { target, value } of allNba) {
      this.values.set(target.name, extendTo(value, this.compiled.widthOf(target.name)));
    }
  }

  /** 조합논리(assign/게이트/always@*)를 고정점까지 반복 평가한다. */
  settleCombinational() {
    for (let iter = 0; iter < MAX_SETTLE_ITERATIONS; iter++) {
      let changed = false;

      for (const driver of this.compiled.combDrivers) {
        const newVal = extendTo(driver.eval(this.getFn), this.compiled.widthOf(driver.target.name));
        changed = this.writeIfChanged(driver.target, newVal) || changed;
      }

      for (const lb of this.compiled.levelBlocks) {
        const ctx: ExecContext = {
          scratch: new Map(this.values),
          nba: [],
          widthOf: (n) => this.compiled.widthOf(n),
        };
        execStmt(lb.block.body, ctx);
        for (const [name, val] of ctx.scratch) {
          if (!bitsEqual(this.get(name), val)) {
            this.values.set(name, val);
            changed = true;
          }
        }
      }

      if (!changed) return;
    }
    this.events.push({ kind: "combSettleFailed", detail: "조합 논리가 안정화되지 않았습니다(피드백 루프 의심)" });
  }

  private writeIfChanged(target: LValue, value: Bit[]): boolean {
    if (target.bitSelect === undefined && !target.rangeSelect) {
      const cur = this.get(target.name);
      if (bitsEqual(cur, value)) return false;
      this.values.set(target.name, value);
      return true;
    }
    const full = [...this.get(target.name)];
    let changed = false;
    if (target.bitSelect !== undefined) {
      const idx = full.length - 1 - target.bitSelect;
      if (full[idx] !== value[value.length - 1]) {
        full[idx] = value[value.length - 1];
        changed = true;
      }
    } else if (target.rangeSelect) {
      const [hi, lo] = target.rangeSelect;
      const start = full.length - 1 - hi;
      const end = full.length - 1 - lo;
      const lo2 = Math.min(start, end);
      const seg = extendTo(value, Math.abs(hi - lo) + 1);
      for (let i = 0; i < seg.length; i++) {
        if (full[lo2 + i] !== seg[i]) {
          full[lo2 + i] = seg[i];
          changed = true;
        }
      }
    }
    if (changed) this.values.set(target.name, full);
    return changed;
  }

  snapshot(): Record<string, Bit[]> {
    const out: Record<string, Bit[]> = {};
    for (const [k, v] of this.values) out[k] = v;
    return out;
  }
}

export function compile(module: ModuleDecl): CompiledCircuit {
  return new CompiledCircuit(module);
}

export { toUnsigned, fromUnsigned };
export type { Bit };
