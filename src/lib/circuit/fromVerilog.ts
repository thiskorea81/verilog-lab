import type { ModuleDecl, Expr, Stmt, AlwaysBlock, SensItem } from "../verilog/ast";
import type { CircuitGraph, CircuitNode, PinRef, NodeKind } from "./types";
import { newId } from "./types";
import { layoutCircuit } from "./layout";

export interface FromVerilogResult {
  graph: CircuitGraph;
  warnings: string[];
}

interface Deferred {
  to: PinRef;
  netName: string;
}

export function circuitFromVerilog(module: ModuleDecl): FromVerilogResult {
  const warnings: string[] = [];
  const graph: CircuitGraph = { moduleName: module.name, nodes: [], wires: [] };
  const netProducers = new Map<string, PinRef>();
  const deferred: Deferred[] = [];
  const clockSignals = new Set<string>();

  for (const item of module.items) {
    if (item.type === "always") {
      for (const s of item.sensitivity) {
        if (s.edge === "posedge" || s.edge === "negedge") clockSignals.add(s.signal);
      }
    }
  }

  for (const decl of module.portDecls) {
    if (decl.kind !== "input") continue;
    const kind: NodeKind = clockSignals.has(decl.name) ? "clock" : "input";
    const node: CircuitNode = { id: newId("n"), kind, x: 0, y: 0, label: decl.name };
    graph.nodes.push(node);
    netProducers.set(decl.name, { nodeId: node.id, pin: "y" });
  }

  function resolveOrDefer(name: string, to: PinRef) {
    const p = netProducers.get(name);
    if (p) {
      graph.wires.push({ id: newId("w"), from: p, to });
    } else {
      deferred.push({ to, netName: name });
    }
  }

  function decomposeExpr(expr: Expr, hintName: string): PinRef {
    switch (expr.type) {
      case "ident": {
        // 즉시 해결을 시도하되, 안 되면 임시 버퍼 노드를 만들어 나중에 연결한다.
        const p = netProducers.get(expr.name);
        if (p) return p;
        const buf: CircuitNode = { id: newId("n"), kind: "buf", x: 0, y: 0, label: `${expr.name}_buf` };
        graph.nodes.push(buf);
        deferred.push({ to: { nodeId: buf.id, pin: "a" }, netName: expr.name });
        return { nodeId: buf.id, pin: "y" };
      }
      case "const": {
        const v = expr.bits.every((b) => b === 1) ? "input" : "input"; // 상수는 입력 노드로 대체 표현
        const node: CircuitNode = { id: newId("n"), kind: "input", x: 0, y: 0, label: `const_${expr.bits.join("")}` };
        graph.nodes.push(node);
        void v;
        return { nodeId: node.id, pin: "y" };
      }
      case "unary": {
        if (expr.op !== "~") {
          warnings.push(`축약 연산자(&,|,^)는 회로도로 정확히 표현되지 않습니다: ${hintName}`);
        }
        const src = decomposeExpr(expr.operand, hintName);
        const node: CircuitNode = { id: newId("n"), kind: "not", x: 0, y: 0, label: hintName };
        graph.nodes.push(node);
        graph.wires.push({ id: newId("w"), from: src, to: { nodeId: node.id, pin: "a" } });
        return { nodeId: node.id, pin: "y" };
      }
      case "binary": {
        const kindMap: Partial<Record<string, NodeKind>> = {
          "&": "and", "|": "or", "^": "xor", "~^": "xnor",
        };
        const kind = kindMap[expr.op];
        if (!kind) {
          warnings.push(`연산자 '${expr.op}'는 회로도로 표현할 수 없어 이 부분은 생략됩니다: ${hintName}`);
          const node: CircuitNode = { id: newId("n"), kind: "buf", x: 0, y: 0, label: hintName };
          graph.nodes.push(node);
          const src = decomposeExpr(expr.left, hintName);
          graph.wires.push({ id: newId("w"), from: src, to: { nodeId: node.id, pin: "a" } });
          return { nodeId: node.id, pin: "y" };
        }
        const l = decomposeExpr(expr.left, hintName);
        const r = decomposeExpr(expr.right, hintName);
        const node: CircuitNode = { id: newId("n"), kind, x: 0, y: 0, label: hintName, inputCount: 2 };
        graph.nodes.push(node);
        graph.wires.push({ id: newId("w"), from: l, to: { nodeId: node.id, pin: "a" } });
        graph.wires.push({ id: newId("w"), from: r, to: { nodeId: node.id, pin: "b" } });
        return { nodeId: node.id, pin: "y" };
      }
      case "ternary": {
        const a = decomposeExpr(expr.else, hintName);
        const b = decomposeExpr(expr.then, hintName);
        const sel = decomposeExpr(expr.cond, hintName);
        const node: CircuitNode = { id: newId("n"), kind: "mux2", x: 0, y: 0, label: hintName };
        graph.nodes.push(node);
        graph.wires.push({ id: newId("w"), from: a, to: { nodeId: node.id, pin: "a" } });
        graph.wires.push({ id: newId("w"), from: b, to: { nodeId: node.id, pin: "b" } });
        graph.wires.push({ id: newId("w"), from: sel, to: { nodeId: node.id, pin: "sel" } });
        return { nodeId: node.id, pin: "y" };
      }
      case "concat":
      case "replicate":
        warnings.push(`연결/반복 연산자({...})는 회로도로 표현할 수 없어 이 부분은 생략됩니다: ${hintName}`);
        return decomposeExpr(
          expr.type === "concat" ? expr.items[0] : expr.item,
          hintName
        );
    }
  }

  // DFF 패턴 인식: always @(posedge clk [or posedge/negedge rst]) if(rst) q<=0; else q<=d; 또는 q<=d; 만 있는 경우
  function tryMatchDff(block: AlwaysBlock): { clk: SensItem; rst?: SensItem; target: string; d: Expr } | null {
    const clk = block.sensitivity.find((s) => s.edge === "posedge" || s.edge === "negedge");
    if (!clk) return null;
    const rst = block.sensitivity.find((s) => s !== clk && (s.edge === "posedge" || s.edge === "negedge"));

    const body = block.body.type === "block" ? block.body.stmts : [block.body];
    if (body.length !== 1) return null;
    const stmt = body[0];

    if (stmt.type === "nonblockingAssign") {
      return { clk, rst: undefined, target: stmt.lhs.name, d: stmt.rhs };
    }
    if (stmt.type === "if" && rst) {
      const thenBody = unwrapSingle(stmt.then);
      const elseBody = stmt.else ? unwrapSingle(stmt.else) : null;
      if (thenBody?.type === "nonblockingAssign" && elseBody?.type === "nonblockingAssign") {
        if (thenBody.lhs.name === elseBody.lhs.name) {
          return { clk, rst, target: thenBody.lhs.name, d: elseBody.rhs };
        }
      }
    }
    return null;
  }
  function unwrapSingle(s: Stmt): Stmt | null {
    if (s.type === "block") return s.stmts.length === 1 ? s.stmts[0] : null;
    return s;
  }

  for (const item of module.items) {
    if (item.type === "gate") {
      const node: CircuitNode = { id: newId("n"), kind: item.gate, x: 0, y: 0, label: item.instanceName, inputCount: item.inputs.length };
      graph.nodes.push(node);
      const outLv = item.outputs[0];
      netProducers.set(outLv.name, { nodeId: node.id, pin: "y" });
    }
  }
  for (const item of module.items) {
    if (item.type !== "gate") continue;
    const node = graph.nodes.find((n) => netProducers.get(item.outputs[0].name)?.nodeId === n.id)!;
    const pinNames = item.gate === "not" || item.gate === "buf" ? ["a"] : item.inputs.map((_, i) => String.fromCharCode(97 + i));
    item.inputs.forEach((inputExpr, i) => {
      if (inputExpr.type === "ident") {
        resolveOrDefer(inputExpr.name, { nodeId: node.id, pin: pinNames[i] });
      } else {
        const src = decomposeExpr(inputExpr, `${item.instanceName}_in${i}`);
        graph.wires.push({ id: newId("w"), from: src, to: { nodeId: node.id, pin: pinNames[i] } });
      }
    });
  }

  for (const item of module.items) {
    if (item.type !== "always") continue;
    const dff = tryMatchDff(item);
    if (!dff) {
      warnings.push(`always 블록을 회로도로 변환할 수 없어 생략되었습니다(지원 패턴: 단순 D 플립플롭). 신호: ${collectTargets(item.body).join(", ")}`);
      continue;
    }
    const node: CircuitNode = { id: newId("n"), kind: "dff", x: 0, y: 0, label: dff.target };
    graph.nodes.push(node);
    netProducers.set(dff.target, { nodeId: node.id, pin: "q" });
    resolveOrDefer(dff.clk.signal, { nodeId: node.id, pin: "clk" });
    if (dff.rst) resolveOrDefer(dff.rst.signal, { nodeId: node.id, pin: "rst" });
    if (dff.d.type === "ident") {
      resolveOrDefer(dff.d.name, { nodeId: node.id, pin: "d" });
    } else {
      const src = decomposeExpr(dff.d, `${dff.target}_d`);
      graph.wires.push({ id: newId("w"), from: src, to: { nodeId: node.id, pin: "d" } });
    }
  }

  for (const item of module.items) {
    if (item.type !== "assign") continue;
    const lhsName = item.lhs.name;
    if (item.rhs.type === "ident") {
      // 단순 전달(assign y = x;) — 별도 노드 없이 동일 신호로 취급
      const p = netProducers.get(item.rhs.name);
      if (p) netProducers.set(lhsName, p);
      else deferred.push({ to: { nodeId: "__alias__", pin: lhsName }, netName: item.rhs.name });
    } else {
      const src = decomposeExpr(item.rhs, lhsName);
      netProducers.set(lhsName, src);
    }
  }

  for (const decl of module.portDecls) {
    if (decl.kind !== "output") continue;
    const node: CircuitNode = { id: newId("n"), kind: "output", x: 0, y: 0, label: decl.name };
    graph.nodes.push(node);
    resolveOrDefer(decl.name, { nodeId: node.id, pin: "a" });
  }

  for (const d of deferred) {
    const p = netProducers.get(d.netName);
    if (!p) {
      warnings.push(`신호 '${d.netName}'을(를) 만드는 곳을 찾지 못했습니다.`);
      continue;
    }
    if (d.to.nodeId === "__alias__") continue; // alias는 이미 netProducers로 처리됨(방문 순서상 드묾)
    graph.wires.push({ id: newId("w"), from: p, to: d.to });
  }

  layoutCircuit(graph);
  return { graph, warnings };
}

function collectTargets(stmt: Stmt): string[] {
  const out = new Set<string>();
  function visit(s: Stmt) {
    switch (s.type) {
      case "block":
        s.stmts.forEach(visit);
        break;
      case "blockingAssign":
      case "nonblockingAssign":
        out.add(s.lhs.name);
        break;
      case "if":
        visit(s.then);
        if (s.else) visit(s.else);
        break;
      case "case":
        s.cases.forEach((c) => visit(c.body));
        if (s.defaultStmt) visit(s.defaultStmt);
        break;
    }
  }
  visit(stmt);
  return [...out];
}
