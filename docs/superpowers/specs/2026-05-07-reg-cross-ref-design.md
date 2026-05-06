# Cross-Region Pharma Reg Web Service — Design Spec

> Working codename: `reg-cross-ref`. 3개 브랜드 후보는 §10 참조.
> 작성일: 2026-05-07
> Brainstorm 세션: Korean Law MCP 모티브 → scope 확장 → standalone 웹서비스 + MCP secondary

---

## 1. Project context & motivation

한국 식약처(MFDS)·HIRA·복지부 + 글로벌 4개 규제기관(FDA·EMA·PMDA·NMPA)의 의약품 규제·급여 정보를 **단일 웹 서비스 + MCP 서버**로 통합 제공한다. Korean Law MCP의 운영 패턴(무료 정부 API + 무료 호스팅 + MIT)을 헬스케어 도메인에 적용하되, 5-region cross-reference라는 unique angle로 차별화한다.

**1차 목적 (E)**: 오픈소스 포트폴리오 / GitHub 가시성 / 글로벌 reg 커뮤니티 인지도. 수익형 SaaS가 아니라 visibility 자산.

**2차 목적 (C)**: 사용자 본인의 MA 직무(Survodutide MASH 런치) 즉시 활용. Dogfooding이 product feedback loop를 형성.

**3차 목적 (F)**: 국내·글로벌 reg 산업 종사자에게 공익적 도구 제공.

**Korean Law MCP와의 차별화**:
- Korean Law MCP는 MCP 서버 자체가 product (CLI + connector). 본 프로젝트는 **웹 서비스가 product, MCP는 secondary surface**.
- 도메인이 헬스케어 specific이라 데이터 schema·쿼리 패턴·도메인 용어가 완전히 다름.
- 5-region cross-reference는 상용 도구(IQVIA, Cortellis, Citeline — $100K/yr) 영역. 오픈소스 무료 도구가 같은 축을 다룬다는 것 자체가 portfolio piece의 USP.

**PharmaNova와의 관계**:
- A 옵션(PharmaNova 흡수) 폐기 — 본 프로젝트는 standalone.
- 단 PharmaNova가 외부 의존성으로 본 서비스의 MCP/REST API를 consume 가능. 즉 마이크로서비스 분리 구조.
- 아키텍처 scaffold는 PharmaNova fork (Next.js + Prisma + Clerk + Gemini) — 흡수가 아닌 **scaffold 재활용**.

**임상의용 급여 lookup MCP** (별도 프로젝트, TODO):
- "이 환자 BMI에서 처방 가능한 GLP-1 RA 급여기준" 류 임상 컨텍스트 도구.
- 같은 HIRA 데이터를 share하지만 페르소나·UX·메시징이 다름.
- v0.1 본 프로젝트와 분리. PharmaNova가 둘 다 호출 가능.

---

## 2. Persona

**v0.1 1차 페르소나 — B2B 규제 산업 풀셋**:
- 빅파마 / CRO 임상시험팀
- RA (Regulatory Affairs)
- PV (Pharmacovigilance)
- 바이오텍 founder/팀
- MA (Medical Affairs)
- 규제변호사

**자연 unlock — v0.5 시점 (FDA 추가)**:
- 글로벌 reg professional (한국에 무지하지만 cross-region 비교 시 진입)

**의도적 제외**:
- 임상의 (별도 MCP)
- 환자/시민 (장기 옵션, v1.0+)

---

## 3. Scope (v0.1 → v1.5 roadmap)

| Phase | 범위 | 추정 (claude 시간) | 핵심 difficulty |
|---|---|---|---|
| **v0.1** | 한국 (식약처 + HIRA + 복지부 + KPIS) | ~50시간 (10일 × 5h) | OC 키 발급 + ATC/KDC/EDI 매핑 |
| **v0.5** | + FDA (openFDA) | ~15시간 | PharmaNova 기존 코드 fork |
| **v1.0** | + EMA (EPAR scrape + medicines DB) | ~30시간 | 정식 API 없음 → scrape + PDF parse |
| **v1.5** | + PMDA + NMPA (Asia bundle) | ~25시간 | JP·CN 의약품 명칭 정규화 |
| **v2** | 의료기기 | ~30시간 (60-70% c-level reuse) | GMDN/한국 분류, 510(k)/De Novo/PMA/MDR/IVDR 별 lifecycle |
| **v3** | DTx / AI SaMD | 별도 sub-project | EU AI Act, FDA AI/ML SaMD Action Plan, 식약처 디지털헬스기기 가이드라인 |

**총 v0.1~v1.5 합계**: ~120시간 = 24일 × 5h/day = ~5주 압축 / 12주 분산.

---

## 4. Architecture overview

```
┌──────────────────────────────────────────────────────┐
│ Surfaces (3)                                         │
│  • Web UI (primary)         — Next.js 16 App Router │
│  • MCP server (secondary)   — /mcp endpoint, MCP SDK│
│  • REST API (optional)      — /api/v1/*              │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│ Application layer                                    │
│  • Search / lookup / chain tools                    │
│  • LLM Q&A orchestrator (Gemini 2.5 Flash)          │
│  • Citation verifier (Korean Law MCP 패턴)          │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│ Data access (Prisma)                                 │
│  • Postgres (Neon) + pgvector — Hybrid layer (b)    │
│  • Knowledge graph deferred (b → c upgrade path)    │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│ ETL / Source plugin layer (sketch-c)                 │
│  • Source plugin (abstract base + per-source impl)  │
│  • Parser plugin (HTML / PDF / JSON)                │
│  • Schedule (cron) + cache (1h search / 24h text)   │
└──────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│ External sources                                     │
│  v0.1: 식약처 OpenAPI · HIRA · 복지부 · KPIS         │
│  v0.5+: openFDA · EMA · PMDA · NMPA                 │
└──────────────────────────────────────────────────────┘
```

**Sketch-c 원칙**:
- 구조(source/parser/transport plugin)는 c-level 추상화 적용.
- 데이터 모델은 drug-shaped + non-drug entity hook만 둠. 의료기기 v2 진입 시 schema 정식 refactor (rule of three).

---

## 5. Data layer

**v0.1 선택: b (Hybrid)** — Postgres + pgvector.

| 레이어 | 용도 |
|---|---|
| Postgres relational tables | 약물·승인·결정·고시 등 정형 entity |
| Postgres GIN index | 정확매칭 + 키워드 검색 |
| pgvector embedding | 결정사유·EPAR·라벨 자유텍스트 의미검색 (LLM Q&A backing) |

**임베딩 모델**: Gemini `text-embedding-004` ($0.025/1M token), 768차원. 결정사유 PDF chunk당 ~500토큰 기준 1만 결정 = 50만 토큰 = $0.0125 — 무시할 수준.

**c (Knowledge graph) 업그레이드 트리거**:
- v1.0 EMA 추가 후 cross-region entity 매핑이 relational join으로 답답해질 때.
- 또는 "동일 ATC class 약물의 결정 패턴 클러스터링" 같은 graph query가 핵심 product 가치가 될 때.
- 그 전에는 entity ID 매핑 테이블 + foreign key 조인으로 충분.

---

## 6. Data sources (v0.1 KR)

| Source | URL / API | 데이터 | 인증 |
|---|---|---|---|
| **식약처 의약품안전나라** | nedrug.mfds.go.kr OpenAPI | 허가 의약품 상세, indication, 라벨, RMS, 회수, 부작용 | 공공데이터포털 키 |
| **HIRA — 약평위 결과** | hira.or.kr 공시 + 보도자료 | 약평위 평가결과 PDF, 안건별 결정사유 (공개분), 등재 history | 비API (스크래핑 + PDF 파싱) |
| **HIRA — 암질심 결과** | hira.or.kr | 회의결과 PDF, 안건별 가/부, 결정 요지 | 비API (스크래핑) |
| **HIRA — 급여기준** | hira.or.kr 보험인정기준 | 약제 급여기준, 사용범위, 본인부담 | 비API (스크래핑) |
| **복지부 고시** | mohw.go.kr / mw.go.kr 고시·공고 | 약가·요양급여 고시 원문 | 비API (스크래핑) |
| **KPIS** | kpis.or.kr | 의약품 통계·약가추이 | 일부 API |

**영구 out (v0.1 scope에서 제외)**:
- HIRA raw 토의록 (비공개 원칙)
- 정보공개청구 신규 누적 path (별도 검토, 영구 out 가능)

**HIRA 회의록 reality**:
- 약평위/암질심 둘 다 결과 PDF + 보도자료 + 안건별 결정사유 일부까지 웹 공개.
- 회의 raw 토의록은 비공개 원칙. 정보공개청구로만 부분 입수.
- v0.1은 웹 공개분만 풀 파싱. 이것만으로도 "고시 이면의 hx 드릴다운"의 70~80%는 달성 가능.

---

## 7. Core entities (sketch schema)

```typescript
// Drug — 약물 entity, 활성성분 + 한국 식약처 표준코드 기준 정규화
Drug {
  id, kfdaCode, atc, ingredient, brandNames[], category, modality
  approvals: Approval[]
  reimbursements: Reimbursement[]
  decisions: Decision[]
  // v2 hook: deviceFields? — null for drugs, populated for devices
}

// Approval — 규제기관별 허가 (한국 + 글로벌 5축)
Approval {
  id, drugId, region (KR|FDA|EMA|PMDA|NMPA), authority
  productName, indication, approvalDate, approvalType (NDA|BLA|MA|...)
  expeditedPathway? (Breakthrough|PRIME|...)
  labelDocId, status (active|withdrawn|...)
}

// Reimbursement — 한국 급여 결정 (HIRA)
Reimbursement {
  id, drugId, decisionType (등재|급여확대|약가조정|삭제)
  effectiveDate, edicode, ceilingPrice, copay
  basis: Decision (FK)
}

// Decision — 약평위·암질심·고시 결정 단위
Decision {
  id, body (약평위|암질심|복지부고시), meetingNo, meetingDate
  agenda, drugId?, ruling (가|부|보류|기타), rulingText
  rationaleText (텍스트 + pgvector 임베딩)
  sourceDocId
}

// SourceDocument — 모든 출처 PDF/HTML provenance
SourceDocument {
  id, source (mfds|hira|mohw|kpis|openfda|...), url, fetchedAt
  contentHash, parsedAt, parser (소스별 plugin name)
}

// CrossRegionLink — 한국 vs 글로벌 동일 약물 매핑 (v0.5+)
CrossRegionLink {
  drugId, region, externalId, matchMethod (exact|atc|fuzzy|manual)
  confidence
}
```

**v2 의료기기 진입 시 refactor 포인트**:
- `Drug` → `Product` (drug + device 통합) 또는 별도 `Device` entity
- Lifecycle stage가 다름: 의약품(임상→허가→급여→PMS) vs 의료기기(KGMP→510(k)/De Novo/PMA→급여→PMS)
- 분류체계 GMDN(글로벌) + 한국 의료기기 4등급

---

## 8. Tool surface

**Korean Law MCP 패턴 차용**: search → lookup → chain tools 3계층.

### Search tools (v0.1)
- `search_drug(query, region?)` — 약물명·성분·ATC 검색
- `search_decision(query, body?, dateRange?)` — 약평위/암질심/고시 결정 검색
- `search_notice(query, type?)` — 복지부 고시 검색

### Lookup tools (v0.1)
- `get_drug(id|kfdaCode)` — 약물 상세 (허가 + 급여 + 결정 history)
- `get_decision(id)` — 결정 단위 상세 + rationale
- `get_label(approvalId)` — 라벨 텍스트
- `get_reimbursement_history(drugId)` — 급여 결정 timeline

### Chain tools (v0.1)
- `chain_drug_dossier(query)` — 약물 검색 → 허가 + 급여 + 결정 history 통합
- `chain_decision_rationale(query)` — 결정 검색 → 안건 본문 + 보도자료 + 관련 고시 통합
- `chain_amendment_track(drugId)` — 약가·급여 변경 history + 사유

### Cross-region chain tools (v0.5+)
- `chain_compare_global_approval(drugName)` — 5-region 허가 status 비교
- `chain_compare_label(drugName, indication)` — region별 라벨 diff
- `chain_indication_gap(drugName)` — region별 indication 차이

### Citation verifier (v0.1 필수)
- `verify_citations(text)` — Korean Law MCP의 `verify_citations` 패턴. LLM 답변 인용 검증.

---

## 9. Tech stack

```
Framework      : Next.js 16 App Router + React 19 + Tailwind 4 + shadcn/ui
ORM            : Prisma 7 (driver adapter, Postgres + pgvector)
DB             : Neon Postgres + pgvector extension
Auth           : Clerk
LLM            : Gemini 2.5 Flash (cascade 2.5 → 2.0 fallback) + text-embedding-004
MCP server     : @modelcontextprotocol/sdk (TypeScript)
Hosting        : Vercel (web + light cron) + Neon (DB) + Render/Railway (PDF parsing 같은 무거운 cron job; Vercel Cron 10s timeout 회피)
Cache          : Redis (Upstash) — 1h search / 24h text
Source code    : TypeScript, monorepo 아님 (단일 Next.js app + ETL 패키지 옵션)
```

**비용 추정 (v0.1 자체 운영)**:
- Vercel Hobby/Pro: $0~$20/월
- Neon Free/Launch: $0~$19/월
- Clerk Free: $0/월 (10K MAU)
- Upstash Redis Free: $0/월
- Gemini API: 사용량 기반 (소량 dogfooding 시 <$5/월)
- → MVP: $0~$50/월

---

## 10. Naming & branding (3 후보, 사용자 선택)

| 후보 | 어원 | 톤 | parallel |
|---|---|---|---|
| **RegGalaxy** | Reg(ulation) + Galaxy. CT-Galaxy와 family naming | 우주 메타포 | CT-Galaxy 직접 parallel |
| **Pharmacopia** | Pharmacopoeia 변주. "약전 + utopia/copious" 합성 | 어휘 풍부함 강조 | 독립 |
| **RegistryX** | Registry + Cross. 다지역 cross-reference 강조 | 기능 직접 표현 | 독립 |

**사용자 결정 후 적용**: 폴더명 `reg-cross-ref` → `<picked-name>` 리네임, README/MCP 서버명/도메인 동일 통일.

---

## 11. Acceptance criteria (v0.1 ship)

**User-facing query (4건, 웹 UI + MCP 둘 다 작동)**:

1. **약물 dossier**: "Wegovy 한국 허가 + 급여 등재 timeline"
2. **결정사유 hx**: "삼성바이오에피스 OO 약가협상 결정사유 history"
3. **약평위 검색**: "2024년 약평위 통과 GLP-1 RA 약물 list"
4. **고시 추적**: "2024 보험약가 인하 고시 + 적용 약물"

**Deliverable (3건)**:

5. Web UI 배포 (Vercel, 공개 도메인)
6. MCP connector instruction (Claude Desktop config 1줄, claude.ai 웹 connector 등록)
7. README + GitHub repo public + 오픈소스 라이선스 (MIT)

**Non-acceptance (v0.1 시점에 작동 안 해도 됨)**:
- Cross-region 비교 (v0.5)
- 의미검색 기반 "유사 결정 끌어내기" (pgvector 작동하면 OK이나 acceptance criterion 아님)
- raw 토의록 검색 (영구 out)

---

## 12. Risks & mitigations

| Risk | 영향 | Mitigation |
|---|---|---|
| HIRA PDF schema 변동 | 파서 깨짐 | fixture-driven test, monthly canary 자동 검증 |
| 라벨/EPAR 텍스트 라이선스 | 법적 risk | 출처 명시 + 비상업적 사용 명시 + opt-out 절차 |
| 식약처 API rate limit | 사용자 차단 | 서버측 캐싱 + 사용자 키 fallback (Korean Law MCP의 OC 패턴) |
| pgvector 임베딩 비용 | 운영비 | text-embedding-004 = $0.025/1M tok. 1만 결정 = $0.0125. 무시 |
| Gemini 토큰 폭증 | 비용 sunset | PharmaNova처럼 free tier credit / Pro upgrade gate (v1.0 이후) |
| 본인 BI 재직 중 commercial 표시 | compliance | v1.5까지는 무료 + portfolio 명시. M5 상용화는 BI exit 동기화 |
| HIRA 회의록 공개 범위 변동 | scope 깨짐 | 웹 공개분 baseline 정의, v0.1 ingest 시 캐시 보존 |

---

## 13. Out of scope (영구 또는 별도 phase)

| 항목 | 상태 |
|---|---|
| 임상의용 급여 lookup UI | 별도 MCP 프로젝트 (TODO) |
| 의료기기 | v2 (60-70% c-level reuse 가정) |
| DTx / AI SaMD | v3 또는 별도 sub-project |
| HIRA raw 토의록 | 영구 out (비공개) |
| HIRA 정보공개청구 신규 path | 영구 또는 별도 검토 |
| 일반 환자/시민 UX | 장기 옵션, v1.0+ |
| 상용화 (Stripe, pricing tier) | M5, BI exit 동기화 |

---

## 14. Open questions (plan 단계로 이연)

1. **Drug entity 정규화 strategy**: 한국 식약처 표준코드 vs ATC vs INN. 다중 매핑 테이블이 정답일 가능성.
2. **Cross-region drug matching**: 활성성분(INN) base가 가장 robust. brand name은 region별로 다름. 매핑 confidence score 필요.
3. **Cron schedule**: HIRA 약평위는 월 1~2회 → daily check 충분. 식약처 허가는 매주 → daily check.
4. **MCP 인증**: Korean Law MCP는 OC 키 query parameter. 우리도 같은 패턴? Clerk와 별도 키?
5. **국문/영문 일등시민 처리**: Persona가 글로벌 reg pro 포함 → 영문 라벨/UI도 자연스럽게. i18n 전략은 plan 단계.
6. **MCP tool 개수 cap**: Korean Law MCP가 89→15로 consolidate. 우리는 처음부터 ~10~15개로 시작.
7. **PharmaNova와의 의존 방향**: PharmaNova가 본 서비스를 consume. 그 인터페이스 (MCP? REST API?) 결정.

---

## Appendix A. Roadmap claude-hours estimate

| Phase | Estimate | 분포 (대략) |
|---|---|---|
| v0.1 | ~50h | scaffold 5h + ETL 20h + 웹 UI 15h + MCP 5h + 테스트/배포 5h |
| v0.5 | ~15h | openFDA 통합 8h + cross-region UI 5h + 테스트 2h |
| v1.0 | ~30h | EMA scrape 15h + EPAR 파싱 10h + UI 확장 5h |
| v1.5 | ~25h | PMDA 10h + NMPA 12h + Asia bundle UI 3h |
| **합계 v0.1~v1.5** | **~120h** | |

**User 결정 시간 (병목)**: phase별 +2~5시간 (회의록 schema 검증, naming, UI mockup 리뷰 등).

**Calendar 환산**:
- 압축 (5h/day daily): ~25일 = 5주
- 분산 (2h/day weekday): ~75일 = 15주

---

## Appendix B. v0.1 Definition of Done 체크리스트

```
[ ] 식약처 OpenAPI 키 발급 + 환경 설정
[ ] 식약처 의약품 상세 ingest + 정규화
[ ] HIRA 약평위 결과 PDF parser
[ ] HIRA 암질심 결과 PDF parser
[ ] HIRA 급여기준 scraper
[ ] 복지부 고시 scraper
[ ] KPIS 통계 fetch
[ ] Drug / Approval / Reimbursement / Decision / SourceDocument schema
[ ] pgvector 결정사유 embedding 파이프라인
[ ] Web UI: 검색 + 약물 상세 + 결정 상세 + 고시 상세
[ ] MCP server: 10~15개 tool surface + connector test
[ ] LLM Q&A orchestrator + verify_citations
[ ] cron worker (daily ingest)
[ ] 5개 acceptance criteria query 통과
[ ] README + 호스팅 배포 + Claude Desktop connector instruction
```
