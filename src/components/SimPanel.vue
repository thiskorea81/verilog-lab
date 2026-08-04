<script setup lang="ts">
import { computed } from "vue";
import type { CompiledCircuit } from "../lib/verilog/simulate";
import type { Bit } from "../lib/verilog/bits";
import { bitsToString } from "../lib/verilog/bits";
import { generateTruthTable, isCombinational } from "../lib/verilog/truthTable";

const props = defineProps<{
  compiled: CompiledCircuit;
  values: Record<string, Bit[]>;
  history: { label: string; values: Record<string, Bit[]> }[];
}>();
const emit = defineEmits<{
  (e: "setInput", name: string, bits: Bit[]): void;
  (e: "clockPulse", name: string): void;
}>();

const inputSignals = computed(() =>
  [...props.compiled.signals.values()].filter((s) => s.isInput)
);
const outputSignals = computed(() =>
  [...props.compiled.signals.values()].filter((s) => s.isOutput)
);
const clockSignals = computed(() =>
  new Set(props.compiled.clockedBlocks.flatMap((cb) => cb.edgeSignals.map((s) => s.signal)))
);
const combinational = computed(() => isCombinational(props.compiled));
const truthTable = computed(() => (combinational.value ? generateTruthTable(props.compiled) : null));

function toggleBit(name: string, width: number, bitIndex: number) {
  const cur = props.values[name] ?? Array(width).fill(0);
  const next = [...cur];
  const idx = width - 1 - bitIndex;
  next[idx] = next[idx] === 1 ? 0 : 1;
  emit("setInput", name, next as Bit[]);
}

function ledColor(bits?: Bit[]) {
  if (!bits || bits.length === 0) return "#d4d4d8";
  if (bits.some((b) => b === "x")) return "#f59e0b";
  return bits.some((b) => b === 1) ? "#22c55e" : "#71717a";
}
</script>

<template>
  <div class="sim-panel">
    <section class="io-section">
      <div class="io-col">
        <h4>입력</h4>
        <div v-for="s in inputSignals" :key="s.name" class="io-row">
          <span class="sig-name">{{ s.name }}<span v-if="clockSignals.has(s.name)" class="clk-badge">CLK</span></span>
          <div class="bit-toggles">
            <button
              v-for="bi in s.width"
              :key="bi"
              class="bit-btn"
              :class="{ on: (values[s.name]?.[s.width - bi]) === 1 }"
              @click="toggleBit(s.name, s.width, s.width - bi)"
            >{{ values[s.name]?.[s.width - bi] ?? "x" }}</button>
          </div>
          <button v-if="clockSignals.has(s.name)" class="pulse-btn" @click="emit('clockPulse', s.name)">
            클록 펄스 ⏱
          </button>
        </div>
      </div>
      <div class="io-col">
        <h4>출력</h4>
        <div v-for="s in outputSignals" :key="s.name" class="io-row">
          <span class="sig-name">{{ s.name }}</span>
          <span class="led" :style="{ background: ledColor(values[s.name]) }"></span>
          <span class="led-value">{{ bitsToString(values[s.name] ?? []) }}</span>
        </div>
      </div>
    </section>

    <section v-if="truthTable" class="truth-table-section">
      <h4>진리표 (조합 논리 회로)</h4>
      <p v-if="truthTable.truncated" class="note">
        입력 조합이 많아 처음 {{ truthTable.rows.length }}개만 표시합니다 (전체 {{ truthTable.totalCombinations }}개).
      </p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="n in truthTable.inputNames" :key="'hi' + n">{{ n }}</th>
              <th v-for="n in truthTable.outputNames" :key="'ho' + n" class="out-col">{{ n }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in truthTable.rows" :key="i">
              <td v-for="n in truthTable.inputNames" :key="'i' + n">{{ bitsToString(row.inputs[n]) }}</td>
              <td v-for="n in truthTable.outputNames" :key="'o' + n" class="out-col">{{ bitsToString(row.outputs[n]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="history-section">
      <h4>클록 이력 (순서 논리 회로)</h4>
      <p v-if="history.length === 0" class="note">클록 펄스 버튼을 눌러 레지스터 동작을 확인하세요.</p>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>단계</th>
              <th v-for="s in [...inputSignals, ...outputSignals]" :key="s.name">{{ s.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(h, i) in history" :key="i">
              <td>{{ h.label }}</td>
              <td v-for="s in [...inputSignals, ...outputSignals]" :key="s.name">
                {{ bitsToString(h.values[s.name] ?? []) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sim-panel { display: flex; flex-direction: column; gap: 16px; }
.io-section { display: flex; gap: 32px; flex-wrap: wrap; }
.io-col h4 { margin: 0 0 8px; font-size: 13px; color: #57534e; }
.io-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sig-name { font-family: ui-monospace, monospace; font-size: 13px; min-width: 60px; }
.clk-badge { font-size: 9px; background: #ede9fe; color: #6d28d9; padding: 1px 4px; border-radius: 4px; margin-left: 4px; }
.bit-toggles { display: flex; gap: 2px; }
.bit-btn {
  width: 22px; height: 22px; font-family: ui-monospace, monospace; font-size: 12px;
  border: 1px solid #d4d4d8; background: #fafafa; border-radius: 4px; cursor: pointer;
}
.bit-btn.on { background: #16a34a; color: white; border-color: #16a34a; }
.pulse-btn {
  font-size: 12px; padding: 3px 8px; border-radius: 6px; border: 1px solid #7c3aed;
  color: #7c3aed; background: white; cursor: pointer;
}
.led { width: 14px; height: 14px; border-radius: 50%; display: inline-block; border: 1px solid #00000022; }
.led-value { font-family: ui-monospace, monospace; font-size: 12px; color: #57534e; }
h4 { margin: 0 0 8px; font-size: 13px; color: #57534e; }
.note { font-size: 12px; color: #a1a1aa; }
.table-scroll { overflow-x: auto; }
table { border-collapse: collapse; font-family: ui-monospace, monospace; font-size: 12px; }
th, td { border: 1px solid #e4e4e7; padding: 4px 8px; text-align: center; }
th { background: #fafafa; }
.out-col { background: #f0fdf4; }
</style>
