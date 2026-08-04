import type { CompiledCircuit } from "./simulate";
import { Simulation } from "./simulate";
import { fromUnsigned, bitsToString, type Bit } from "./bits";

export interface TruthTableRow {
  inputs: Record<string, Bit[]>;
  outputs: Record<string, Bit[]>;
}

export interface TruthTableResult {
  inputNames: string[];
  outputNames: string[];
  rows: TruthTableRow[];
  totalCombinations: number;
  truncated: boolean;
}

const MAX_ROWS = 256; // 8개 입력 비트까지 (교육용 예제에 충분)

/** 조합논리 모듈(클록형 always 블록이 없는 경우)에 대해 모든 입력 조합의 진리표를 생성한다. */
export function isCombinational(compiled: CompiledCircuit): boolean {
  return compiled.clockedBlocks.length === 0;
}

export function generateTruthTable(compiled: CompiledCircuit): TruthTableResult {
  const inputNames = [...compiled.signals.values()].filter((s) => s.isInput).map((s) => s.name);
  const outputNames = [...compiled.signals.values()].filter((s) => s.isOutput).map((s) => s.name);
  const totalBits = inputNames.reduce((sum, n) => sum + compiled.widthOf(n), 0);
  const totalCombinations = 2 ** totalBits;
  const truncated = totalCombinations > MAX_ROWS;
  const limit = Math.min(totalCombinations, MAX_ROWS);

  const rows: TruthTableRow[] = [];
  for (let combo = 0; combo < limit; combo++) {
    const sim = new Simulation(compiled);
    let shift = totalBits;
    const inputs: Record<string, Bit[]> = {};
    for (const name of inputNames) {
      const w = compiled.widthOf(name);
      shift -= w;
      const val = (combo >> shift) & ((1 << w) - 1);
      const bits = fromUnsigned(val, w);
      sim.setInput(name, bits);
      inputs[name] = bits;
    }
    sim.settleCombinational();
    const outputs: Record<string, Bit[]> = {};
    for (const name of outputNames) outputs[name] = sim.get(name);
    rows.push({ inputs, outputs });
  }

  return { inputNames, outputNames, rows, totalCombinations, truncated };
}

export { bitsToString };
