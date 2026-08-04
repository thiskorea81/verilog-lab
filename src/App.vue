<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink to="/" class="brand">Verilog Lab</RouterLink>
      <nav>
        <RouterLink to="/theory/intro">이론: 소개</RouterLink>
        <RouterLink to="/theory/combinational">이론: 조합 논리</RouterLink>
        <RouterLink to="/theory/sequential">이론: 순서 논리</RouterLink>
        <RouterLink to="/lab" class="lab-link">실습 →</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; background: #fafaf9; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-bottom: 1px solid #e4e4e7; background: white;
  flex-wrap: wrap; gap: 12px;
}
.brand { font-weight: bold; font-size: 16px; color: #1f2328; text-decoration: none; }
nav { display: flex; gap: 18px; }
nav a { color: #57534e; text-decoration: none; font-size: 14px; }
nav a.router-link-active { color: #7c3aed; font-weight: bold; }
.lab-link {
  background: #7c3aed; color: white !important; padding: 6px 14px; border-radius: 8px;
  font-weight: bold;
}
</style>
