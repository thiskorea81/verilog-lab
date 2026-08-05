# 설계 문서 (Design)

이 문서는 Verilog Lab이 내부적으로 어떻게 동작하는지 정리한다. 코드를 다시 손볼 때
"왜 이렇게 짜여 있는지"를 빠르게 파악할 수 있도록 하는 것이 목적이다.

## 1. 전체 구조

**완전 정적(static) 웹앱** — 서버가 없다. Verilog 파싱, 시뮬레이션, 회로 변환이 전부
브라우저(클라이언트) 안에서 TypeScript로 실행된다. 그래서 Netlify 같은 정적 호스팅에
그대로 올라간다(빌드 산출물 `dist/`를 서빙하기만 하면 끝).

```
사용자 입력
  ├─ Verilog 코드 편집 ──┐
  │                      ▼
  │              parseVerilog() → ModuleDecl(AST)
  │                      │
  └─ 회로도 편집(캔버스) ─┼──→ circuitFromVerilog(AST) → CircuitGraph
                          │←── circuitToVerilog(CircuitGraph) → Verilog 텍스트
                          ▼
                  compile(AST) → CompiledCircuit
                          ▼
                  new Simulation(CompiledCircuit)
                          ▼
              사용자가 입력 스위치/클록 펄스 조작
                          ▼
              값 갱신 → 진리표 / LED / 클록 이력표 렌더링
```

핵심 설계 결정: **회로도와 Verilog 코드는 서로 "실시간 동기화"되지 않는다.** 사용자가
둘 중 하나를 편집한 뒤 "코드 → 회로도" 또는 "회로도 → 코드" 버튼을 눌러야 반영된다.
키 입력마다 자동 동기화하면 파싱 오류가 잦은 편집 중간 상태에서 계속 튕겨서 오히려
방해가 되기 때문에, 명시적 변환 버튼을 택했다(`src/views/LabView.vue`의
`convertCodeToCircuit` / `convertCircuitToCode`).

시뮬레이션은 **회로도 모드에서도 항상 Verilog 텍스트를 거쳐서 돈다** —
`circuitToVerilog(graph)`로 코드를 만들고 그걸 다시 파싱해서 시뮬레이션한다. 별도의
"그래프 전용 시뮬레이터"를 만들지 않은 이유: 텍스트 경로와 회로도 경로가 같은 엔진을
타야 두 모드의 시뮬레이션 결과가 항상 일치한다는 게 보장되고, 테스트도 하나로 충분하다.

## 2. Verilog 파서 (`src/lib/verilog/`)

### 지원 범위(교육용 부분집합)

- `module` / `input` / `output` / `wire` / `reg` 선언, 비트 폭 `[hi:lo]`
- `assign lhs = expr;`
- 게이트 프리미티브 인스턴스: `and, or, not, nand, nor, xor, xnor, buf`
- `always @(posedge/negedge/*)` 블록 — `if/else`, `case/endcase/default`,
  블로킹(`=`)/논블로킹(`<=`) 대입, `begin/end` 블록
- 연산자: `& | ^ ~^(~/^~) ~ + - == != && || ? : { } {n{...}}`(연결/반복)

지원하지 않음: `function`/`task`, `generate`, 3상(`z`), `parameter`가 있는 모듈
인스턴스, 배열/메모리, `initial` 블록, `for`/`while`.

### 파이프라인

`tokenizer.ts`(문자열 → 토큰) → `parser.ts`(재귀 하강 파서, 토큰 → `ast.ts`의
`ModuleDecl`). 외부 파서 생성기(yacc류)를 쓰지 않고 손으로 짠 이유는 문법이 작아서
직접 짜는 게 더 빠르고 디버깅도 쉽기 때문이다.

식(expression) 파싱은 우선순위 클라이밍(precedence climbing) 방식이다. 우선순위는
낮은 것부터: 삼항(`?:`) → `||` → `&&` → `==`/`!=` → `|` → `^`/`~^` → `&` → `+`/`-`
→ 단항(`~`) → 기본식(리터럴/식별자/괄호/연결). 실제 Verilog 표준 우선순위를 그대로
따르지는 않고 교육용 예제에 필요한 만큼만 단순화했다.

숫자 리터럴은 `<폭>'<진법><값>` 형식(`4'b1010`, `8'hFF`, `3'd5`)과 크기 없는 10진수
(`1`, `0`)를 지원한다. `x`/`z`가 섞인 자리는 전부 `x`(부정)로 취급한다(3상 `z`는
별도 상태로 구분하지 않는다 — 교육 범위에서 굳이 필요하지 않다고 판단).

### 알려진 함정 (재발 방지용 기록)

- `^`와 `~^`(XNOR)를 같은 파서 루프에서 처리하다가 **토큰 종류를 확인하지 않고
  무조건 XNOR로 만드는 버그**가 있었다(`parser.ts`의 `parseBitXor`). 반가산기 테스트
  (`assign sum = a ^ b`)가 이 버그를 바로 잡아냈다 — 회로 관련 로직은 반드시 실제
  진리표로 검증하는 브루트포스 테스트를 같이 짤 것.
- 토크나이저에 `*`, `+`, `-` 같은 단일 문자 기호를 빠뜨리면 `always @(*)`나
  `count + 1` 같은 아주 흔한 문법에서 "알 수 없는 문자" 에러가 난다. 새 연산자를
  추가할 때는 파서뿐 아니라 `tokenizer.ts`의 단일 문자 punct 목록도 같이 고칠 것.

## 3. 시뮬레이션 엔진 (`simulate.ts`)

3-state(`0`/`1`/`x`) 비트 벡터 기반. 값은 항상 MSB→LSB 순서 배열(`Bit[]`)로 표현한다
(`bits.ts`).

### 컴파일 단계 (`compile()` → `CompiledCircuit`)

AST를 순회하며 세 그룹으로 나눈다:

- `combDrivers`: `assign`문과 게이트 인스턴스 — "이 신호는 이 함수로 계산된다"는
  (타깃, 평가함수) 쌍의 목록
- `clockedBlocks`: `posedge`/`negedge` 감지 목록이 있는 `always` 블록(순서 논리)
- `levelBlocks`: `always @(*)` 또는 순수 레벨 감지 목록인 `always` 블록(조합 논리를
  `case`/`if`로 기술한 경우)

### 조합 논리 — 고정점(fixed-point) 반복

`settleCombinational()`이 모든 `combDrivers`와 `levelBlocks`를 최대
`MAX_SETTLE_ITERATIONS`(1000)번까지 반복 평가하면서, 어떤 신호도 더 이상 바뀌지
않을 때까지(고정점) 돈다. 이렇게 하면 항 순서와 무관하게 항상 같은 결과가 나오고,
피드백이 있는 조합 회로(래치 등)도 이론적으로는 다룰 수 있다. 1000번을 넘기면
"조합 논리가 안정화되지 않았습니다(피드백 루프 의심)" 이벤트를 남기고 멈춘다 —
실제로 발진(oscillation)하는 회로를 사용자가 만들었을 때 무한 루프에 빠지지 않게
하는 안전장치다.

### 순서 논리 — 엣지 감지 + 논블로킹(NBA) 세맨틱

`setInput(name, value)`가 호출될 때마다:

1. 이전 값과 새 값을 비교해 `posedge`(0→1 또는 x→1)/`negedge`(1→0 또는 x→0)인지
   판정한다(`runClockedBlocksForTransition`).
2. 그 엣지에 물려 있는 `always` 블록들을 **엣지 발생 시점의(=변경 직전) 신호값**으로
   평가한다. 블로킹 대입(`=`)은 블록 실행 중 즉시 스크래치 값에 반영되고(그래서 같은
   블록 안 다음 문장이 곧바로 새 값을 읽을 수 있다), 논블로킹 대입(`<=`)은 목록에만
   쌓아 뒀다가 **모든 트리거된 블록이 다 끝난 뒤 한꺼번에** 실제 신호 테이블에
   반영한다. 실제 하드웨어의 플립플롭들이 같은 클록 엣지에서 "동시에" 갱신되는 것과
   같은 순서를 흉내 낸 것이다.
3. 레지스터 값이 바뀌었을 수 있으므로 `settleCombinational()`을 다시 돌려 그
   변화가 조합 논리 출력까지 전파되게 한다.

이 설계로 아래와 같은 전형적인 패턴이 전부 테스트로 검증됐다
(`src/lib/verilog/__tests__/simulate.test.ts`):
D 플립플롭(비동기 리셋 포함), 토글 플립플롭(`q <= ~q` 피드백), 2비트 카운터
(`count <= count + 1`, 오버플로 시 자동 랩어라운드).

### 알고 있는 단순화

- 4-상태(`0/1/x/z`) 중 고임피던스(`z`)는 지원하지 않는다.
- 한 `always` 블록 안에서 `if`의 조건이 `x`이면 두 분기 모두 타지 않는다(실제
  시뮬레이터라면 두 분기 결과가 다르면 출력을 `x`로 만드는 게 더 정확하지만, 교육용
  범위에서는 단순화했다).
- 게이트 프리미티브에 다중 비트 신호가 들어오면 비트별로 계산하지 않고 OR로 축약해서
  1비트로 취급한다(`reduceToScalar`). 실제 게이트 프리미티브는 원래 1비트 입출력만
  다루므로 이 사이트에서 다중 비트 로직은 `assign` + 연산자로 기술하는 걸 권장한다.

## 4. 진리표 / 클록 이력 (`truthTable.ts`, `SimPanel.vue`)

`isCombinational(compiled)`가 `clockedBlocks.length === 0`인지만 확인해서 진리표
모드/클록 모드를 가른다. 진리표는 입력 비트 총합이 8비트(256가지)를 넘으면 처음
256개만 보여주고 잘라낸다(`MAX_ROWS`) — 그 이상은 표가 아니라 파형으로 보는 게
맞는 규모라고 판단했다.

클록 이력은 별도 파형 뷰어를 만드는 대신, 클록 펄스를 누를 때마다 그 시점의 전체
신호 스냅샷을 표 형태로 쌓는 방식으로 단순화했다(`LabView.vue`의 `clockPulse`,
최근 20단계까지만 보관).

## 5. 회로도 캔버스 (`src/lib/circuit/`)

### 데이터 모델 (`types.ts`)

`CircuitGraph = { nodes: CircuitNode[], wires: Wire[] }`. 노드 종류(`NodeKind`)는
`input, output, clock, and, or, not, nand, nor, xor, xnor, buf, dff, mux2`.
`pinSpecOf(node)`가 노드 종류별 입력/출력 핀 이름을 정의한다(N입력 게이트는
`a, b, c, ...`, DFF는 `d, clk, rst`→`q`, MUX는 `a, b, sel`→`y`).

배선(`Wire`)은 `{from: PinRef, to: PinRef}` — 항상 "출력 핀 → 입력 핀" 방향으로만
저장한다(입력 핀은 최대 배선 1개, 캔버스에서 이미 배선된 입력 핀에 새로 연결하면
기존 배선을 갈아 끼운다).

### 게이트 도형 (`gateShape.ts`, `GateBody.vue`)

AND/OR/NOT/XOR 등의 IEEE 스타일 게이트 심볼을 SVG path로 직접 계산한다(외부 도형
라이브러리 없음). AND는 원호(arc)로 된 반원, OR/XOR는 베지어 곡선, NOT/BUF는 삼각형,
반전 출력(NAND/NOR/XNOR/NOT)은 출력 쪽에 작은 원(버블)을 붙인다. 좌표 공식은 게이트
높이(`h`, 입력 개수에 비례)에 대한 비율로 계산해서 N입력 게이트도 같은 공식으로
그릴 수 있게 했다.

### 캔버스 상호작용 (`CircuitCanvas.vue`)

- **노드 이동**: 노드 몸체 `mousedown` → 캔버스 `mousemove`로 좌표 갱신 → `mouseup`
  종료. 별도 라이브러리 없이 순수 SVG 좌표 계산.
- **배선 연결**: 출력 핀(초록 테두리) `mousedown`으로 시작 → 임시 점선이 마우스를
  따라다니다가 → 입력 핀(흰 테두리) 위에서 `mouseup`하면 배선 확정.
- **삭제**: 노드/배선 클릭으로 선택 → Delete/Backspace. 노드를 지우면 거기 연결된
  배선도 같이 정리한다.
- **팬/줌은 지원하지 않는다** — 캔버스가 넓어지면 그냥 스크롤(`overflow: auto`)되게만
  했다. 교육용 예제 규모(게이트 10개 안팎)에서는 팬/줌이 굳이 필요 없다고 판단했다.

## 6. 회로 ⇄ Verilog 양방향 변환

### 회로 → Verilog (`toVerilog.ts`)

1. `input`/`clock` 노드 → `input` 포트, `output` 노드 → `output` 포트.
2. 그 외 모든 내부 노드(게이트/DFF/MUX)에 `w1, w2, ...` 순번으로 신호 이름을 붙인다
   (DFF의 출력만 `reg`로, 나머지는 `wire`로 선언).
3. 각 노드의 입력 핀에 연결된 배선을 따라가서 소스 신호 이름을 찾는다
   (`sourceSignal`). 연결이 안 된 핀은 `1'b0`으로 채우고 경고를 남긴다.
4. 게이트는 `게이트종류 인스턴스이름(출력, 입력...);`으로, DFF는
   `always @(posedge clk [or posedge rst]) ... <= ...;`로, MUX2는
   `assign y = sel ? b : a;`로 각각 방출한다.

### Verilog → 회로 (`fromVerilog.ts`)

**두 단계로 나눈 이유**: `assign y = a & w1;`처럼 아직 선언되지 않은(파일 뒤쪽에서
만들어지는) 신호를 참조할 수 있기 때문에, 한 번에 순서대로 처리하면 forward
reference를 못 푼다.

1. **1단계**: 게이트 인스턴스와 `always`(DFF 패턴)를 먼저 다 만들어서 "이 신호는
   이 노드가 만든다"는 대응표(`netProducers: Map<신호이름, PinRef>`)를 채운다. 이때
   입력 신호를 바로 못 찾으면(아직 안 만들어졌으면) `deferred` 목록에 적어 둔다.
2. **2단계**: 모든 아이템을 처리한 뒤(`netProducers`가 다 채워진 뒤) `deferred`
   목록을 한 번에 해소해서 실제 배선(`Wire`)을 만든다.

`assign` 문의 우변 식(`Expr`)은 재귀적으로 게이트 노드로 분해한다
(`decomposeExpr`) — `&`→AND 노드, `^`→XOR 노드, 삼항(`?:`)→MUX2 노드 하는 식으로
연산자 하나당 노드 하나씩 만든다. 그래서 `assign y = (a & b) | (~c);`처럼 중첩된
식도 여러 게이트가 연결된 회로로 정확히 펼쳐진다.

**DFF 패턴 인식** (`tryMatchDff`): `always` 블록 본문이 다음 두 형태 중 하나일 때만
DFF 노드로 바꾼다.
- `q <= d;` (리셋 없음)
- `if (rst) q <= 상수; else q <= d;` (비동기 리셋 있음, `rst`가 감지 목록에도 있어야 함)

이 패턴에 맞지 않는 `always` 블록(`case`문이 들어있거나, 대입이 여러 개거나 등)은
**회로도로 변환하지 않고 경고만 남긴다** — 임의의 순서 논리 코드를 게이트 수준으로
합성(synthesis)하는 건 이 프로젝트의 범위 밖이라고 명확히 선을 그은 부분이다.

### 자동 배치 (`layout.ts`)

위상 정렬 기반 레이어 배치. 입력/클록 노드는 0열, 그 외 노드는 "자신에게 들어오는
배선의 소스 노드 중 가장 깊은 열 + 1"에 배치한다(`computeDepth`, 재귀 + 방문 중
집합으로 순환 방지 — DFF의 피드백 배선이 있어도 무한 재귀에 빠지지 않는다). 출력
노드는 항상 가장 마지막 열에 배치한다.

## 7. 테스트 전략

`vitest`로 19개 테스트가 있고, 전부 **"실제로 시뮬레이션을 돌려서 진리표/파형이
맞는지"** 확인하는 방식이다(구현 세부사항이 아니라 동작을 검증). 특히
`src/lib/circuit/__tests__/roundtrip.test.ts`는 Verilog 텍스트 → 회로도 → 다시
Verilog로 변환한 뒤 시뮬레이션해서, 원본과 똑같이 동작하는지까지 확인한다 — 파서와
회로 변환기 양쪽에 버그가 있어도 결과가 우연히 맞아떨어지는 걸 최대한 걸러내기
위해서다.

```bash
npm test        # vitest run
npm run build   # vue-tsc -b && vite build (타입체크 + 프로덕션 빌드)
```

## 8. 알려진 한계 / 앞으로 확장한다면

- 다중 비트 게이트 프리미티브(예: 4비트 AND 게이트 한 방)는 없음 — `assign`으로
  우회.
- `case`문이 있는 순서 논리(`always @(posedge clk) case(state) ...`)는 회로도로
  변환 안 됨(경고만 표시). 상태 머신(FSM)을 회로도로 그리려면 `fromVerilog.ts`의
  DFF 패턴 인식을 확장해야 한다.
- 3상(`z`)/양방향 버스(`inout`) 미지원.
- 캔버스 팬/줌 없음, 다중 선택/복사·붙여넣기 없음.
