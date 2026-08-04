<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <article class="theory">
    <h1>2. 조합 논리 회로</h1>
    <p>
      조합 논리 회로는 <strong>현재 입력값만으로 출력이 즉시 결정</strong>되는 회로다(AND, OR, 가산기, 디코더 등).
      Verilog에서 조합 논리를 기술하는 방법은 크게 두 가지다: <code>assign</code>문과 게이트 프리미티브 인스턴스.
    </p>

    <h2>방법 1) assign 연속 대입</h2>
    <p>
      <code>assign 출력 = 논리식;</code> 형태로, 오른쪽 식의 값이 바뀌면 왼쪽 신호가 즉시(계속) 갱신된다.
      일반 프로그래밍 언어의 대입과 달리 "한 번 실행되고 끝"이 아니라 "항상 연결되어 있다"는 뜻이다.
    </p>
    <pre><code>module and_gate(a, b, y);
  input a, b;
  output y;
  assign y = a &amp; b;   // y는 항상 a AND b
endmodule</code></pre>
    <table class="op-table">
      <thead><tr><th>연산자</th><th>의미</th></tr></thead>
      <tbody>
        <tr><td><code>&amp;</code></td><td>AND</td></tr>
        <tr><td><code>|</code></td><td>OR</td></tr>
        <tr><td><code>^</code></td><td>XOR</td></tr>
        <tr><td><code>~^</code> (또는 <code>^~</code>)</td><td>XNOR</td></tr>
        <tr><td><code>~</code></td><td>NOT(단항)</td></tr>
        <tr><td><code>? :</code></td><td>삼항 연산자(멀티플렉서와 동일한 동작)</td></tr>
        <tr><td><code>{a, b}</code></td><td>비트 연결(concatenation)</td></tr>
      </tbody>
    </table>

    <h2>방법 2) 게이트 프리미티브 인스턴스</h2>
    <p>
      실제 게이트를 하나씩 배치하듯 <code>게이트종류 인스턴스이름(출력, 입력1, 입력2, ...);</code> 형태로도 쓸 수 있다.
      회로도와 1:1로 대응되기 때문에 이 사이트의 회로도 편집기와 가장 잘 맞는 방식이다.
    </p>
    <pre><code>module xor_from_nand(a, b, y);
  input a, b;
  output y;
  wire n1, n2, n3;
  nand g1(n1, a, b);
  nand g2(n2, a, n1);
  nand g3(n3, n1, b);
  nand g4(y, n2, n3);
endmodule</code></pre>
    <p>
      이 예제는 NAND 게이트 4개만으로 XOR 게이트를 만든 유명한 회로다(NAND는 AND·OR·NOT을 모두 만들 수 있는
      <strong>범용 게이트</strong>이기 때문이다). "실습" 탭의 예제 목록에서 바로 불러와 진리표를 확인해 볼 수 있다.
    </p>

    <h2>임의 상태(don't care)와 카노 맵 간소화</h2>
    <p>
      여러 개의 곱(AND)항을 OR로 묶으면 진리표에서 출력이 1인 모든 경우를 표현할 수 있다. 다만 그대로 쓰면
      게이트 수가 많아지므로, 실제 회로를 설계할 때는 카노 맵이나 불 대수로 논리식을 간소화한 뒤 Verilog로 옮긴다.
      예를 들어 반가산기(half adder)의 합(sum)과 자리올림(carry)은 다음과 같이 매우 간단히 표현된다.
    </p>
    <pre><code>module half_adder(a, b, sum, cout);
  input a, b;
  output sum, cout;
  assign sum  = a ^ b;  // 두 입력이 다를 때만 1
  assign cout = a &amp; b;  // 두 입력이 모두 1일 때만 자리올림
endmodule</code></pre>

    <h2>always @(*) — 표(case)로 조합 논리 기술하기</h2>
    <p>
      진리표가 복잡하면 <code>assign</code>보다 <code>case</code>문이 더 읽기 편할 때가 많다.
      <code>always @(*)</code>는 "오른쪽 어떤 신호든 바뀌면 즉시 다시 계산하라"는 뜻으로, 조합 논리에 사용한다
      (순서 논리에 쓰는 <code>always @(posedge clk)</code>와 혼동하지 말 것 — 다음 장에서 다룬다).
    </p>
    <pre><code>module mux4(sel, d0, d1, d2, d3, y);
  input [1:0] sel;
  input d0, d1, d2, d3;
  output reg y;   // always 블록에서 대입하므로 reg로 선언
  always @(*) begin
    case (sel)
      2'b00: y = d0;
      2'b01: y = d1;
      2'b10: y = d2;
      default: y = d3;
    endcase
  end
endmodule</code></pre>
    <p class="note">
      <code>always</code> 블록 안에서 대입되는 신호는 반드시 <code>reg</code>로 선언해야 한다(실제로 저장 소자가
      생긴다는 뜻이 아니라, Verilog 문법상의 규칙이다 — <code>always @(*)</code>처럼 조합 논리로만 쓰이면
      합성 결과는 여전히 게이트일 뿐 플립플롭이 생기지 않는다).
    </p>

    <nav class="theory-nav">
      <RouterLink to="/theory/intro">← 이전: Verilog 소개</RouterLink>
      <RouterLink to="/theory/sequential">다음: 순서 논리 회로 →</RouterLink>
    </nav>
  </article>
</template>

<style scoped>
.theory { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }
h1 { font-size: 26px; margin-bottom: 20px; }
h2 { font-size: 18px; margin: 32px 0 10px; }
p { line-height: 1.8; margin: 0 0 14px; }
.note { color: #a1a1aa; font-size: 13px; border-left: 3px solid #e4e4e7; padding-left: 12px; }
.op-table { border-collapse: collapse; margin: 12px 0; font-size: 14px; }
.op-table th, .op-table td { border: 1px solid #e4e4e7; padding: 6px 12px; text-align: left; }
.op-table th { background: #fafafa; }
.theory-nav { display: flex; justify-content: space-between; margin-top: 40px; font-weight: bold; }
</style>
