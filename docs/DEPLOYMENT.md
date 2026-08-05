# 배포 정보 (Deployment)

## 어디에 올라가 있는가

| | |
|---|---|
| **소스 코드** | https://github.com/thiskorea81/verilog-lab (public) |
| **배포 사이트(운영)** | https://veriloglab.netlify.app |
| **Netlify Project name** | veriloglab |
| **Netlify Owner** | cbnu team |
| **Netlify Project ID (Site ID)** | `d8105fb9-88ab-4837-8b56-e4da5aa44a67` |
| **생성일** | 2026-08-03 |

GitHub는 `thiskorea81` 개인 계정, Netlify는 `cbnu team` 팀 계정으로 서로 다른
계정에 걸쳐 있다는 점에 유의 — Netlify 쪽 프로젝트 설정(빌드 훅, 팀원 권한 등)을
바꾸려면 `cbnu team` 계정으로 Netlify에 로그인해야 한다.

## 배포 방식: GitHub 연동 자동 배포

Netlify가 GitHub 저장소(`thiskorea81/verilog-lab`)의 `main` 브랜치를 직접 보고
있다. **`main`에 push하면 자동으로 새 빌드가 시작되고, 성공하면 그대로
`veriloglab.netlify.app`에 반영된다.** 별도로 `netlify deploy`를 실행할 필요는
없다 — 그냥 평소처럼 커밋하고 push만 하면 된다.

```bash
cd /home/student/Documents/study/verilog-lab
git add -A
git commit -m "..."
git push
```

빌드 설정은 저장소 루트의 [`netlify.toml`](../netlify.toml)에 있다:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- `npm run build`는 `vue-tsc -b && vite build`(타입체크 후 프로덕션 빌드) —
  타입 에러가 있으면 **Netlify 빌드 자체가 실패**하므로, push 전에 로컬에서
  `npm run build`가 통과하는지 먼저 확인하는 걸 권장한다.
- 마지막 `redirects` 블록은 Vue Router(`createWebHistory`, 즉 `/lab`처럼 해시 없는
  주소)를 쓰기 때문에 필요하다. 이게 없으면 `/lab`으로 새로고침하거나 직접 접속했을
  때 Netlify가 그 경로에 해당하는 정적 파일을 못 찾아 404를 낸다 — 모든 경로 요청을
  `index.html`로 돌려서 Vue Router가 클라이언트에서 라우팅을 처리하게 하는 표준
  SPA 설정이다.

## 배포 확인/트러블슈팅

- Netlify 대시보드(https://app.netlify.com, `cbnu team` 계정) → `veriloglab`
  프로젝트에서 배포 로그와 빌드 히스토리를 볼 수 있다.
- 빌드가 실패했다면 십중팔구 `vue-tsc` 타입 에러다. 로컬에서
  `npm run build`로 먼저 재현해서 고친 뒤 다시 push.
- 로컬 프리뷰(빌드 결과를 로컬에서 그대로 확인): `npm run build && npm run preview`

## 로컬 개발 서버와의 차이

로컬 `npm run dev`(Vite dev server)는 이 배포와 별개로 그냥 개발용이다. 로컬에서
잘 되는 것과 Netlify 빌드가 통과하는 것은 다를 수 있다(예: dev 서버는 타입 에러가
있어도 그냥 띄워 주지만, `npm run build`는 `vue-tsc -b`에서 막힌다) — 배포 전에는
반드시 `npm run build`로 확인할 것.
