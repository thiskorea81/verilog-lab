<script setup lang="ts">
import { computed } from "vue";
import type { CircuitNode } from "./types";
import { nodeWidth, nodeHeight } from "./geometry";
import { computeGateShape } from "./gateShape";

const props = defineProps<{ node: CircuitNode; active?: boolean; value?: 0 | 1 | "x" }>();

const w = computed(() => nodeWidth(props.node));
const h = computed(() => nodeHeight(props.node));
const shape = computed(() => computeGateShape(props.node));

const stroke = computed(() => (props.active ? "#7c3aed" : "#1f2328"));
const fill = "#f4f3ec";

function valueColor(v?: 0 | 1 | "x") {
  if (v === 1) return "#16a34a";
  if (v === 0) return "#9ca3af";
  return "#c2410c";
}
</script>

<template>
  <g>
    <template v-if="['and','or','not','nand','nor','xor','xnor','buf'].includes(node.kind)">
      <path :d="shape.bodyPath" :fill="fill" :stroke="stroke" stroke-width="2" />
      <path v-if="shape.extraPath" :d="shape.extraPath" fill="none" :stroke="stroke" stroke-width="2" />
      <circle v-if="shape.bubble" :cx="shape.bubbleCx" :cy="shape.bubbleCy" r="5" :fill="fill" :stroke="stroke" stroke-width="2" />
      <text :x="w / 2" :y="h + 14" text-anchor="middle" font-size="11" fill="#57534e">{{ node.label }}</text>
    </template>

    <template v-else-if="node.kind === 'input'">
      <rect x="0" y="0" :width="w" :height="h" rx="8" :fill="fill" :stroke="stroke" stroke-width="2" />
      <circle :cx="w / 2" :cy="h / 2" r="6" :fill="valueColor(value)" />
      <text :x="w / 2" :y="-8" text-anchor="middle" font-size="12" font-weight="bold" fill="#1f2328">{{ node.label }}</text>
    </template>

    <template v-else-if="node.kind === 'output'">
      <rect x="0" y="0" :width="w" :height="h" rx="8" :fill="fill" :stroke="stroke" stroke-width="2" />
      <circle :cx="w / 2" :cy="h / 2" r="6" :fill="valueColor(value)" />
      <text :x="w / 2" :y="-8" text-anchor="middle" font-size="12" font-weight="bold" fill="#1f2328">{{ node.label }}</text>
    </template>

    <template v-else-if="node.kind === 'clock'">
      <rect x="0" y="0" :width="w" :height="h" rx="8" :fill="fill" :stroke="stroke" stroke-width="2" />
      <path :d="`M ${w*0.2},${h*0.65} L ${w*0.2},${h*0.35} L ${w*0.5},${h*0.35} L ${w*0.5},${h*0.65} L ${w*0.8},${h*0.65} L ${w*0.8},${h*0.35}`"
            fill="none" stroke="#1f2328" stroke-width="1.6" />
      <text :x="w / 2" :y="-8" text-anchor="middle" font-size="12" font-weight="bold" fill="#1f2328">{{ node.label }}</text>
    </template>

    <template v-else-if="node.kind === 'dff'">
      <rect x="0" y="0" :width="w" :height="h" :fill="fill" :stroke="stroke" stroke-width="2" />
      <path :d="`M 0,${h - 12} L 8,${h - 8} L 0,${h - 4}`" fill="none" :stroke="stroke" stroke-width="1.6" />
      <text x="6" :y="14" font-size="10" fill="#57534e">D</text>
      <text :x="w - 12" :y="14" font-size="10" fill="#57534e">Q</text>
      <text x="6" :y="h - 14" font-size="9" fill="#57534e">CLK</text>
      <text x="6" :y="h * 0.55" font-size="9" fill="#57534e">R</text>
      <text :x="w / 2" :y="h + 14" text-anchor="middle" font-size="11" fill="#57534e">{{ node.label }}</text>
    </template>

    <template v-else-if="node.kind === 'mux2'">
      <path :d="`M 6,4 L ${w - 12},${h * 0.2} L ${w - 12},${h * 0.8} L 6,${h - 4} Z`" :fill="fill" :stroke="stroke" stroke-width="2" />
      <text x="10" :y="h * 0.35" font-size="10" fill="#57534e">A</text>
      <text x="10" :y="h * 0.65" font-size="10" fill="#57534e">B</text>
      <text x="10" :y="h - 6" font-size="9" fill="#57534e">SEL</text>
      <text :x="w / 2" :y="h + 14" text-anchor="middle" font-size="11" fill="#57534e">{{ node.label }}</text>
    </template>
  </g>
</template>
