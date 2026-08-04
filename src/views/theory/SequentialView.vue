<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <article class="theory">
    <h1>3. 순서 논리 회로</h1>
    <p>
      순서 논리 회로는 <strong>현재 입력뿐 아니라 이전 상태(기억)</strong>까지 함께 출력을 결정하는 회로다
      (플립플롭, 레지스터, 카운터 등). Verilog에서는 <code>always @(posedge clk)</code> 블록으로
      "클록이 0→1로 바뀌는 순간에만 값을 갱신하라"는 동작을 표현한다.
    </p>

    <h2>posedge / negedge — 클록 엣지</h2>
    <p>
      <code>posedge clk</code>는 clk 신호가 0에서 1로 바뀌는 순간(상승 엣지), <code>negedge clk</code>는
      1에서 0으로 바뀌는 순간(하강 엣지)을 뜻한다. 순서 논리 회로는 보통 이 엣지 순간에만 레지스터 값을 갱신하고,
      그 사이에는 값을 그대로 유지한다 — 이것이 "기억"이 생기는 원리다.
    </p>

    <h2>D 플립플롭과 비동기 리셋</h2>
    <p>
      가장 기본적인 저장 소자는 D 플립플롭이다. 클록이 상승 엣지일 때 입력 d의 값을 그대로 출력 q로
      옮겨 저장한다. 아래 예제는 리셋(rst)이 1이면 클록과 무관하게 즉시 q를 0으로 만드는
      <strong>비동기 리셋</strong>까지 포함한다(감지 목록에 <code>posedge rst</code>가 들어있기 때문).
    </p>
    <pre><code>module dff(clk, rst, d, q);
  input clk, rst, d;
  output reg q;
  always @(posedge clk or posedge rst) begin
    if (rst)
      q &lt;= 1'b0;
    else
      q &lt;= d;
  end
endmodule</code></pre>
    <p>
      <code>&lt;=</code>(논블로킹 대입)은 순서 논리 회로에서 항상 이렇게 사용한다. "이 always 블록이 다 끝난
      뒤에 한꺼번에 반영하라"는 뜻으로, 실제 플립플롭들이 같은 클록에 동시에 값을 갱신하는 것과 같은 순서로
      동작한다. 조합 논리(<code>always @(*)</code>)에서는 반대로 <code>=</code>(블로킹 대입)을 쓴다.
    </p>

    <h2>토글 플립플롭 — 자기 자신을 되먹임(feedback)</h2>
    <p>
      D 플립플롭의 입력에 자기 출력의 반전값을 다시 연결하면, 클록이 뛸 때마다 0→1→0→1로 토글하는
      회로가 된다. "순서 논리는 출력이 다시 입력으로 들어갈 수 있다"는 조합 논리와의 중요한 차이를 보여준다.
    </p>
    <pre><code>module tff(clk, rst, q);
  input clk, rst;
  output reg q;
  always @(posedge clk or posedge rst) begin
    if (rst) q &lt;= 1'b0;
    else q &lt;= ~q;
  end
endmodule</code></pre>

    <h2>카운터 — 여러 비트 레지스터 + 산술 연산</h2>
    <p>
      레지스터 폭을 늘리고(<code>[1:0] count</code>) 매 클록마다 1을 더하면 카운터가 된다. 2비트이므로
      00→01→10→11 다음에는 다시 00으로 돌아간다(자리올림이 밖으로 버려짐, wraparound).
    </p>
    <pre><code>module counter2(clk, rst, count);
  input clk, rst;
  output reg [1:0] count;
  always @(posedge clk or posedge rst) begin
    if (rst) count &lt;= 2'b00;
    else count &lt;= count + 1;
  end
endmodule</code></pre>
    <p class="note">
      "실습" 탭에서 이 예제들을 불러와 클록 펄스 버튼을 눌러 보면, 매 클록마다 상태가 어떻게 바뀌는지
      이력 표로 바로 확인할 수 있다. 조합 논리와 달리 순서 논리는 "진리표" 대신 "클록에 따른 상태 변화표"로
      동작을 확인한다는 점도 눈여겨보자.
    </p>

    <nav class="theory-nav">
      <RouterLink to="/theory/combinational">← 이전: 조합 논리 회로</RouterLink>
      <RouterLink to="/lab">실습하러 가기 →</RouterLink>
    </nav>
  </article>
</template>

<style scoped>
.theory { max-width: 760px; margin: 0 auto; padding: 40px 24px 80px; }
h1 { font-size: 26px; margin-bottom: 20px; }
h2 { font-size: 18px; margin: 32px 0 10px; }
p { line-height: 1.8; margin: 0 0 14px; }
.note { color: #a1a1aa; font-size: 13px; border-left: 3px solid #e4e4e7; padding-left: 12px; }
.theory-nav { display: flex; justify-content: space-between; margin-top: 40px; font-weight: bold; }
</style>
