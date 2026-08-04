<script setup lang="ts">
import { ref, computed } from "vue";
import type { CircuitGraph, CircuitNode, NodeKind, Wire } from "./types";
import { newId, pinSpecOf } from "./types";
import { nodeWidth, nodeHeight, pinOffset, absPinPos } from "./geometry";
import GateBody from "./GateBody.vue";
import type { Bit } from "../verilog/bits";

const props = defineProps<{
  graph: CircuitGraph;
  values?: Record<string, Bit[]>;
}>();
const emit = defineEmits<{ (e: "change"): void }>();

const svgEl = ref<SVGSVGElement | null>(null);
const selected = ref<{ kind: "node" | "wire"; id: string } | null>(null);

const dragging = ref<{ nodeId: string; dx: number; dy: number } | null>(null);
const wiring = ref<{ fromNode: string; fromPin: string; x: number; y: number } | null>(null);

function svgPoint(evt: MouseEvent): { x: number; y: number } {
  const rect = svgEl.value!.getBoundingClientRect();
  return { x: evt.clientX - rect.left + (svgEl.value!.scrollLeft || 0), y: evt.clientY - rect.top };
}

function onNodeMouseDown(node: CircuitNode, evt: MouseEvent) {
  evt.stopPropagation();
  selected.value = { kind: "node", id: node.id };
  const p = svgPoint(evt);
  dragging.value = { nodeId: node.id, dx: p.x - node.x, dy: p.y - node.y };
}

function onOutputPinDown(node: CircuitNode, pin: string, evt: MouseEvent) {
  evt.stopPropagation();
  const p = svgPoint(evt);
  wiring.value = { fromNode: node.id, fromPin: pin, x: p.x, y: p.y };
}

function onInputPinUp(node: CircuitNode, pin: string, evt: MouseEvent) {
  evt.stopPropagation();
  if (!wiring.value) return;
  const already = props.graph.wires.find((w) => w.to.nodeId === node.id && w.to.pin === pin);
  if (already) {
    props.graph.wires.splice(props.graph.wires.indexOf(already), 1);
  }
  const wire: Wire = {
    id: newId("w"),
    from: { nodeId: wiring.value.fromNode, pin: wiring.value.fromPin },
    to: { nodeId: node.id, pin },
  };
  props.graph.wires.push(wire);
  wiring.value = null;
  emit("change");
}

function onCanvasMouseMove(evt: MouseEvent) {
  const p = svgPoint(evt);
  if (dragging.value) {
    const node = props.graph.nodes.find((n) => n.id === dragging.value!.nodeId);
    if (node) {
      node.x = Math.max(0, p.x - dragging.value.dx);
      node.y = Math.max(0, p.y - dragging.value.dy);
    }
  }
  if (wiring.value) {
    wiring.value.x = p.x;
    wiring.value.y = p.y;
  }
}

function onCanvasMouseUp() {
  if (dragging.value) {
    dragging.value = null;
    emit("change");
  }
  if (wiring.value) {
    wiring.value = null; // 핀이 아닌 곳에서 놓으면 취소
  }
}

function onCanvasClick() {
  selected.value = null;
}

function selectWire(id: string, evt: MouseEvent) {
  evt.stopPropagation();
  selected.value = { kind: "wire", id };
}

function deleteSelected() {
  if (!selected.value) return;
  if (selected.value.kind === "node") {
    const id = selected.value.id;
    const idx = props.graph.nodes.findIndex((n) => n.id === id);
    if (idx >= 0) props.graph.nodes.splice(idx, 1);
    props.graph.wires = props.graph.wires.filter((w) => w.from.nodeId !== id && w.to.nodeId !== id);
  } else {
    const idx = props.graph.wires.findIndex((w) => w.id === selected.value!.id);
    if (idx >= 0) props.graph.wires.splice(idx, 1);
  }
  selected.value = null;
  emit("change");
}

function onKeydown(evt: KeyboardEvent) {
  if ((evt.key === "Delete" || evt.key === "Backspace") && selected.value) {
    const target = evt.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    evt.preventDefault();
    deleteSelected();
  }
}

let addCounter = 0;
function addNode(kind: NodeKind) {
  addCounter++;
  const id = newId("n");
  const defaultLabels: Record<string, string> = {
    input: `in${addCounter}`,
    output: `out${addCounter}`,
    clock: "clk",
  };
  const node: CircuitNode = {
    id,
    kind,
    x: 60 + ((addCounter * 37) % 400),
    y: 40 + ((addCounter * 61) % 300),
    label: defaultLabels[kind] ?? `${kind}${addCounter}`,
    inputCount: 2,
  };
  props.graph.nodes.push(node);
  emit("change");
  return node;
}

function wirePath(w: Wire): string {
  const fromNode = props.graph.nodes.find((n) => n.id === w.from.nodeId);
  const toNode = props.graph.nodes.find((n) => n.id === w.to.nodeId);
  if (!fromNode || !toNode) return "";
  const p1 = absPinPos(fromNode, w.from.pin);
  const p2 = absPinPos(toNode, w.to.pin);
  const mx = (p1.x + p2.x) / 2;
  return `M ${p1.x},${p1.y} C ${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
}

function wireValue(w: Wire): Bit[] | undefined {
  const fromNode = props.graph.nodes.find((n) => n.id === w.from.nodeId);
  if (!fromNode || !props.values) return undefined;
  const sigName = fromNode.kind === "input" || fromNode.kind === "clock" ? fromNode.label : fromNode.id;
  return props.values[sigName];
}

function wireColor(w: Wire): string {
  const v = wireValue(w);
  if (!v || v.length === 0) return "#9ca3af";
  if (v.some((b) => b === "x")) return "#c2410c";
  return v.some((b) => b === 1) ? "#16a34a" : "#9ca3af";
}

const wiringStart = computed(() => {
  if (!wiring.value) return null;
  const node = props.graph.nodes.find((n) => n.id === wiring.value!.fromNode);
  if (!node) return null;
  return absPinPos(node, wiring.value.fromPin);
});

const canvasSize = computed(() => {
  let maxX = 600;
  let maxY = 400;
  for (const n of props.graph.nodes) {
    maxX = Math.max(maxX, n.x + nodeWidth(n) + 80);
    maxY = Math.max(maxY, n.y + nodeHeight(n) + 60);
  }
  return { w: maxX, h: maxY };
});

defineExpose({ addNode });
</script>

<template>
  <div
    class="canvas-wrap"
    tabindex="0"
    @keydown="onKeydown"
  >
    <svg
      ref="svgEl"
      :width="canvasSize.w"
      :height="canvasSize.h"
      class="canvas-svg"
      @mousemove="onCanvasMouseMove"
      @mouseup="onCanvasMouseUp"
      @mouseleave="onCanvasMouseUp"
      @click="onCanvasClick"
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eee" stroke-width="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" :width="canvasSize.w" :height="canvasSize.h" fill="url(#grid)" />

      <!-- wires -->
      <path
        v-for="w in graph.wires"
        :key="w.id"
        :d="wirePath(w)"
        fill="none"
        :stroke="selected?.kind === 'wire' && selected.id === w.id ? '#7c3aed' : wireColor(w)"
        stroke-width="2.5"
        style="cursor: pointer"
        @click="(e) => selectWire(w.id, e)"
      />

      <!-- temp wire while dragging a connection -->
      <line
        v-if="wiring && wiringStart"
        :x1="wiringStart.x"
        :y1="wiringStart.y"
        :x2="wiring.x"
        :y2="wiring.y"
        stroke="#7c3aed"
        stroke-width="2"
        stroke-dasharray="4,3"
      />

      <!-- nodes -->
      <g
        v-for="node in graph.nodes"
        :key="node.id"
        :transform="`translate(${node.x},${node.y})`"
      >
        <g @mousedown="(e) => onNodeMouseDown(node, e)" style="cursor: move">
          <rect
            v-if="selected?.kind === 'node' && selected.id === node.id"
            :x="-4" :y="-4" :width="nodeWidth(node) + 8" :height="nodeHeight(node) + 8"
            fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="3,2" rx="6"
          />
          <GateBody :node="node" :value="values?.[node.kind === 'input' || node.kind === 'clock' ? node.label : node.id]?.[0]" />
        </g>

        <!-- input pins -->
        <circle
          v-for="pin in pinSpecOf(node).inputs"
          :key="'in-' + pin"
          :cx="pinOffset(node, pin).x"
          :cy="pinOffset(node, pin).y"
          r="5"
          fill="#fff"
          stroke="#1f2328"
          stroke-width="1.6"
          style="cursor: crosshair"
          @mouseup="(e) => onInputPinUp(node, pin, e)"
        />
        <!-- output pins -->
        <circle
          v-for="pin in pinSpecOf(node).outputs"
          :key="'out-' + pin"
          :cx="pinOffset(node, pin).x"
          :cy="pinOffset(node, pin).y"
          r="5"
          fill="#fff"
          stroke="#16a34a"
          stroke-width="1.8"
          style="cursor: crosshair"
          @mousedown="(e) => onOutputPinDown(node, pin, e)"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.canvas-wrap {
  overflow: auto;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  background: #fff;
  max-height: 70vh;
}
.canvas-svg {
  display: block;
}
</style>
