<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import CircuitCanvas from "../lib/circuit/CircuitCanvas.vue";
import SimPanel from "../components/SimPanel.vue";
import { PALETTE, emptyCircuit, type CircuitGraph, type NodeKind } from "../lib/circuit/types";
import { circuitToVerilog } from "../lib/circuit/toVerilog";
import { circuitFromVerilog } from "../lib/circuit/fromVerilog";
import { parseVerilog, ParseError } from "../lib/verilog/parser";
import { compile, Simulation, type CompiledCircuit } from "../lib/verilog/simulate";
import type { Bit } from "../lib/verilog/bits";
import { EXAMPLES } from "../lib/examples";

const code = ref(EXAMPLES[0].code);
const graph = shallowRef<CircuitGraph>(emptyCircuit("top"));
const canvasRef = ref<InstanceType<typeof CircuitCanvas> | null>(null);

const errorMsg = ref<string | null>(null);
const warnings = ref<string[]>([]);
const compiled = shallowRef<CompiledCircuit | null>(null);
const sim = shallowRef<Simulation | null>(null);
const values = ref<Record<string, Bit[]>>({});
const history = ref<{ label: string; values: Record<string, Bit[]> }[]>([]);
let stepCounter = 0;

function rebuildFromCode() {
  try {
    const m = parseVerilog(code.value);
    errorMsg.value = null;
    const c = compile(m);
    compiled.value = c;
    const s = new Simulation(c);
    s.initialize();
    sim.value = s;
    values.value = s.snapshot();
    history.value = [];
    stepCounter = 0;
  } catch (e) {
    if (e instanceof ParseError) errorMsg.value = e.message;
    else errorMsg.value = String(e);
    compiled.value = null;
    sim.value = null;
  }
}

function convertCodeToCircuit() {
  try {
    const m = parseVerilog(code.value);
    errorMsg.value = null;
    const result = circuitFromVerilog(m);
    graph.value = result.graph;
    warnings.value = result.warnings;
  } catch (e) {
    errorMsg.value = e instanceof ParseError ? e.message : String(e);
  }
}

function convertCircuitToCode() {
  const result = circuitToVerilog(graph.value);
  code.value = result.code;
  warnings.value = result.warnings;
  rebuildFromCode();
}

function addNode(kind: NodeKind) {
  canvasRef.value?.addNode(kind);
}

function onCanvasChange() {
  // 회로가 바뀌면 사용자가 명시적으로 '회로→코드' 버튼을 눌러야 반영됨(자동 동기화 없음)
}

function setInput(name: string, bits: Bit[]) {
  sim.value?.setInput(name, bits);
  values.value = sim.value ? { ...sim.value.snapshot() } : {};
}

function clockPulse(name: string) {
  if (!sim.value) return;
  stepCounter++;
  sim.value.setInput(name, [1]);
  values.value = { ...sim.value.snapshot() };
  history.value.push({ label: `#${stepCounter} ↑`, values: values.value });
  sim.value.setInput(name, [0]);
  values.value = { ...sim.value.snapshot() };
  if (history.value.length > 20) history.value.shift();
}

function loadExample(idx: number) {
  code.value = EXAMPLES[idx].code;
  rebuildFromCode();
}

watch(code, () => rebuildFromCode(), { immediate: true });

const activeTab = ref<"code" | "circuit">("code");
</script>

<template>
  <div class="lab">
    <aside class="examples-bar">
      <h3>예제</h3>
      <button v-for="(ex, i) in EXAMPLES" :key="ex.name" class="example-btn" @click="loadExample(i)">
        {{ ex.name }}
      </button>
    </aside>

    <main class="lab-main">
      <div class="tabs">
        <button :class="{ active: activeTab === 'code' }" @click="activeTab = 'code'">Verilog 코드</button>
        <button :class="{ active: activeTab === 'circuit' }" @click="activeTab = 'circuit'">회로도</button>
        <div class="tab-actions">
          <button class="convert-btn" @click="convertCodeToCircuit(); activeTab = 'circuit'">
            코드 → 회로도 변환 ➜
          </button>
          <button class="convert-btn" @click="convertCircuitToCode(); activeTab = 'code'">
            ⬅ 회로도 → 코드 변환
          </button>
        </div>
      </div>

      <div v-show="activeTab === 'code'" class="editor-pane">
        <textarea v-model="code" spellcheck="false" class="code-editor"></textarea>
      </div>

      <div v-show="activeTab === 'circuit'" class="circuit-pane">
        <div class="palette">
          <button v-for="p in PALETTE" :key="p.kind" class="palette-btn" @click="addNode(p.kind)">
            {{ p.label }}
          </button>
          <p class="palette-hint">
            출력 핀(초록 원)에서 드래그해 입력 핀(흰 원)에 놓으면 배선됩니다.
            노드를 클릭 후 Delete로 삭제할 수 있습니다.
          </p>
        </div>
        <CircuitCanvas ref="canvasRef" :graph="graph" :values="values" @change="onCanvasChange" />
      </div>

      <p v-if="errorMsg" class="error-msg">⚠ {{ errorMsg }}</p>
      <ul v-if="warnings.length" class="warning-list">
        <li v-for="(w, i) in warnings" :key="i">⚠ {{ w }}</li>
      </ul>

      <section v-if="compiled" class="sim-section">
        <SimPanel :compiled="compiled" :values="values" :history="history" @set-input="setInput" @clock-pulse="clockPulse" />
      </section>
    </main>
  </div>
</template>

<style scoped>
.lab { display: flex; gap: 16px; padding: 16px; max-width: 1200px; margin: 0 auto; }
.examples-bar { width: 160px; flex-shrink: 0; }
.examples-bar h3 { font-size: 13px; color: #57534e; margin: 0 0 8px; }
.example-btn {
  display: block; width: 100%; text-align: left; padding: 8px 10px; margin-bottom: 6px;
  border: 1px solid #e4e4e7; border-radius: 8px; background: white; cursor: pointer; font-size: 13px;
}
.example-btn:hover { border-color: #7c3aed; }
.lab-main { flex: 1; min-width: 0; }
.tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.tabs button { padding: 8px 14px; border: 1px solid #e4e4e7; background: white; border-radius: 8px 8px 0 0; cursor: pointer; }
.tabs button.active { background: #1f2328; color: white; border-color: #1f2328; }
.tab-actions { margin-left: auto; display: flex; gap: 8px; }
.convert-btn { border-radius: 8px !important; border: 1px solid #7c3aed !important; color: #7c3aed; background: white; font-size: 12px; padding: 6px 10px; cursor: pointer; }
.editor-pane { }
.code-editor {
  width: 100%; height: 360px; font-family: ui-monospace, monospace; font-size: 13px;
  border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; box-sizing: border-box; resize: vertical;
}
.circuit-pane { display: flex; gap: 12px; }
.palette { width: 140px; flex-shrink: 0; }
.palette-btn {
  display: block; width: 100%; padding: 6px 8px; margin-bottom: 4px; font-size: 12px;
  border: 1px solid #e4e4e7; border-radius: 6px; background: white; cursor: pointer;
}
.palette-btn:hover { border-color: #7c3aed; color: #7c3aed; }
.palette-hint { font-size: 11px; color: #a1a1aa; margin-top: 12px; line-height: 1.5; }
.error-msg { color: #dc2626; font-size: 13px; margin-top: 10px; }
.warning-list { color: #b45309; font-size: 12px; margin-top: 8px; padding-left: 18px; }
.sim-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e4e4e7; }
</style>
