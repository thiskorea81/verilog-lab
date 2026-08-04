<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="home">
    <section class="hero">
      <h1>Verilog 논리 회로 실습실</h1>
      <p class="lead">
        회로도를 그리면 Verilog 코드가 되고, Verilog 코드를 쓰면 회로도가 됩니다.
        조합 논리부터 순서 논리(플립플롭, 카운터)까지 브라우저에서 바로 시뮬레이션해 보세요.
      </p>
      <RouterLink to="/lab" class="cta">지금 바로 실습하기 →</RouterLink>
    </section>

    <section class="cards">
      <RouterLink to="/theory/intro" class="card">
        <h3>1. Verilog 소개</h3>
        <p>module, input/output, wire — 하드웨어 기술 언어(HDL)의 기본 구조를 배웁니다.</p>
      </RouterLink>
      <RouterLink to="/theory/combinational" class="card">
        <h3>2. 조합 논리 회로</h3>
        <p>assign문, 게이트 프리미티브(and/or/nand...)로 조합 논리 회로를 기술합니다.</p>
      </RouterLink>
      <RouterLink to="/theory/sequential" class="card">
        <h3>3. 순서 논리 회로</h3>
        <p>always 블록과 posedge로 플립플롭·카운터 같은 순서 논리 회로를 만듭니다.</p>
      </RouterLink>
      <RouterLink to="/lab" class="card highlight">
        <h3>4. 실습실</h3>
        <p>회로도 ⇄ Verilog 코드를 오가며 직접 그리고, 작성하고, 시뮬레이션합니다.</p>
      </RouterLink>
    </section>

    <section class="scope-note">
      <h3>지원 범위 안내</h3>
      <p>
        이 사이트는 교육용으로 Verilog의 부분집합을 지원합니다: <code>module</code>/<code>input</code>/<code>output</code>/
        <code>wire</code>/<code>reg</code> 선언, <code>assign</code>문, 게이트 프리미티브
        (<code>and, or, not, nand, nor, xor, xnor, buf</code>), <code>always @(posedge/negedge/*)</code> 블록의
        <code>if/case</code>·블로킹(<code>=</code>)/논블로킹(<code>&lt;=</code>) 대입을 지원합니다.
        함수/태스크, generate, 3상(z) 신호 등은 지원하지 않습니다.
      </p>
    </section>
  </div>
</template>

<style scoped>
.home { max-width: 960px; margin: 0 auto; padding: 40px 24px; }
.hero { text-align: center; margin-bottom: 48px; }
.hero h1 { font-size: 32px; margin: 0 0 12px; }
.lead { color: #57534e; font-size: 16px; max-width: 640px; margin: 0 auto 24px; }
.cta {
  display: inline-block; background: #7c3aed; color: white; padding: 10px 22px;
  border-radius: 10px; text-decoration: none; font-weight: bold;
}
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 40px; }
.card {
  display: block; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;
  text-decoration: none; color: inherit; background: white; transition: border-color 0.15s;
}
.card:hover { border-color: #7c3aed; }
.card h3 { margin: 0 0 8px; font-size: 16px; color: #1f2328; }
.card p { margin: 0; font-size: 13px; color: #71717a; line-height: 1.5; }
.card.highlight { background: #faf5ff; border-color: #ddd6fe; }
.scope-note { background: white; border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px 24px; }
.scope-note h3 { margin: 0 0 8px; font-size: 14px; }
.scope-note p { margin: 0; font-size: 13px; line-height: 1.7; color: #57534e; }
</style>
