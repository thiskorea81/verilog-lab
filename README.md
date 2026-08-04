# Verilog Lab

Verilog(교육용 부분집합)로 조합·순서 논리 회로를 배우는 완전 정적 웹앱. 서버가 없다 —
파서·시뮬레이터·회로 편집기가 전부 브라우저에서 동작한다.

- **회로도 ⇄ Verilog 코드 양방향 변환**: 회로도를 그리면 Verilog 코드로, Verilog 코드를 쓰면 회로도로 변환된다.
- **조합 논리 시뮬레이션**: 입력 스위치를 눌러 보거나, 자동 생성된 진리표로 확인.
- **순서 논리 시뮬레이션**: 클록 펄스 버튼으로 플립플롭·카운터 등의 상태 변화를 단계별로 확인.
- **이론 페이지**: Verilog 소개, 조합 논리, 순서 논리 세 챕터.

## 로컬에서 실행하기

```bash
npm install
npm run dev
```

http://localhost:5173 에서 확인.

## 테스트

파서·시뮬레이터·양방향 변환 로직에 대한 단위/통합 테스트가 있다(NAND만으로 만든 XOR,
반가산기, 비동기 리셋 D 플립플롭, 토글 플립플롭, 2비트 카운터 등 실제로 동작을 검증).

```bash
npm test
```

## 빌드 & 배포

```bash
npm run build
```

`dist/`에 정적 파일이 생성된다. Netlify가 이 명령을 그대로 실행해 자동 배포한다(`netlify.toml` 참고).

## 지원하는 Verilog 부분집합

- `module` / `input` / `output` / `wire` / `reg` 선언 (비트 폭 `[n:0]` 포함)
- `assign` 연속 대입문: `& | ^ ~^ ~ + - == != && || ? :`, 연결 `{}`, 반복 `{n{...}}`
- 게이트 프리미티브 인스턴스: `and, or, not, nand, nor, xor, xnor, buf`
- `always @(posedge/negedge/*)` 블록의 `if/else`, `case`, 블로킹(`=`)/논블로킹(`<=`) 대입

지원하지 않음: function/task, generate, 3상(z) 신호, 파라미터화된 모듈 인스턴스, 배열/메모리.

## 폴더 구조

```
src/
  lib/verilog/    토크나이저 · 파서 · AST · 시뮬레이션 엔진 · 진리표 생성
  lib/circuit/    회로 그래프 모델 · SVG 캔버스 에디터 · 회로↔Verilog 변환 · 자동 배치
  views/          페이지(홈, 이론 3종, 실습실)
  components/     시뮬레이션 패널(입력 스위치/출력 LED/진리표/클록 이력)
```
