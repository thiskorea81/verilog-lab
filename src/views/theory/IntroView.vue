<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <article class="theory">
    <h1>1. Verilog 소개</h1>
    <p>
      Verilog는 하드웨어 기술 언어(HDL, Hardware Description Language)이다. 일반 프로그래밍 언어가 CPU가
      순서대로 실행할 명령을 적는다면, Verilog는 <strong>동시에 동작하는 디지털 회로(게이트, 배선, 레지스터)</strong>를
      기술한다. 즉 Verilog 코드 한 줄 한 줄이 실제 하드웨어 부품에 대응한다고 생각하면 이해하기 쉽다.
    </p>

    <h2>모듈(module)</h2>
    <p>
      Verilog의 모든 회로는 <code>module</code>로 시작해 <code>endmodule</code>로 끝난다. 모듈은 하나의
      회로 블록(예: AND 게이트, 가산기, 카운터)을 나타내며, 이름과 입출력 포트 목록을 갖는다.
    </p>
    <pre><code>module and_gate(a, b, y);
  input a, b;   // 입력 포트
  output y;     // 출력 포트
  assign y = a &amp; b;
endmodule</code></pre>
    <p>
      <code>module and_gate(a, b, y);</code>는 "and_gate라는 이름의 회로 블록을 만드는데, 바깥과 연결되는
      단자(포트)는 a, b, y 세 개다"라는 뜻이다. 포트 각각이 <code>input</code>(입력)인지 <code>output</code>(출력)인지는
      바로 아래에서 다시 선언한다.
    </p>

    <h2>신호(wire, reg)와 비트 폭</h2>
    <p>
      모듈 내부에서 게이트와 게이트를 잇는 배선은 <code>wire</code>로, <code>always</code> 블록 안에서 값을
      저장(대입)하는 신호는 <code>reg</code>로 선언한다. 기본은 1비트지만 <code>[3:0]</code>처럼 범위를 적으면
      여러 비트를 묶은 버스로 선언할 수 있다.
    </p>
    <pre><code>wire n1;          // 1비트 배선
reg  q;           // 1비트 레지스터(always 블록에서 값을 대입)
input [3:0] a;    // 4비트 입력 버스 (a[3] a[2] a[1] a[0])
output reg [1:0] count;  // 2비트 출력 레지스터</code></pre>
    <p>
      숫자 리터럴은 <code>&lt;비트폭&gt;'&lt;진법&gt;&lt;값&gt;</code> 형식을 쓴다. 예를 들어
      <code>4'b1010</code>은 4비트 2진수 1010, <code>8'hFF</code>는 8비트 16진수 FF(=11111111)이다.
      진법을 생략한 <code>1</code>, <code>0</code> 같은 숫자는 필요한 만큼의 비트 폭으로 자동 처리된다.
    </p>

    <h2>이 사이트가 지원하는 범위</h2>
    <ul>
      <li><code>module</code> / <code>input</code> / <code>output</code> / <code>wire</code> / <code>reg</code> 선언</li>
      <li><code>assign</code> 연속 대입문 (<code>&amp; | ^ ~^ ~ + - == !=</code>, 삼항 연산자 <code>? :</code>, 연결 연산자 <code>{ }</code>)</li>
      <li>게이트 프리미티브 인스턴스: <code>and, or, not, nand, nor, xor, xnor, buf</code></li>
      <li><code>always @(posedge clk)</code> / <code>always @(*)</code> 블록의 <code>if/else</code>, <code>case</code>,
        블로킹(<code>=</code>)·논블로킹(<code>&lt;=</code>) 대입</li>
    </ul>
    <p class="note">
      실제 산업용 Verilog는 이보다 훨씬 방대하다(함수/태스크, generate, 3상 신호 z, 타이밍 제어 등). 이 사이트는
      디지털 논리회로 교육에 필요한 핵심만 구현한 교육용 부분집합이다.
    </p>

    <nav class="theory-nav">
      <span></span>
      <RouterLink to="/theory/combinational">다음: 조합 논리 회로 →</RouterLink>
    </nav>
  </article>
</template>

<style scoped>
.theory { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }
h1 { font-size: 26px; margin-bottom: 20px; }
h2 { font-size: 18px; margin: 32px 0 10px; }
p { line-height: 1.8; margin: 0 0 14px; }
ul { line-height: 1.9; }
.note { color: #a1a1aa; font-size: 13px; border-left: 3px solid #e4e4e7; padding-left: 12px; }
.theory-nav { display: flex; justify-content: space-between; margin-top: 40px; font-weight: bold; }
</style>
