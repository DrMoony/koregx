# KoRegX

> **Korea-anchored cross-region pharma regulatory web service + MCP server.**
> 한국(MFDS·HIRA·복지부)·FDA·EMA·PMDA·NMPA의 의약품 허가·급여·규제 정보를 단일 인터페이스에서 cross-reference.

**Status**: v0.1 design phase (2026-05-07). Implementation kickoff 직전.

## What

5개 규제기관 (한국 식약처/HIRA, FDA, EMA, PMDA, NMPA)의 의약품 데이터를 통합해서 다음과 같은 query를 자연어로 답한다:

- "Wegovy 한국 허가 + 급여 등재 timeline"
- "삼성바이오에피스 OO 약가협상 결정사유 history"
- "2024년 약평위 통과 GLP-1 RA 약물 list"
- "FDA REMS vs 식약처 RMS for opioid X" (v0.5+)
- "한국 미허가지만 FDA 허가된 indication" (v0.5+)

**Surfaces**:
- Web UI (primary)
- MCP server (Claude Desktop, claude.ai, Cursor 등 connector)
- REST API (선택)

## Why

상용 cross-region reg DB (IQVIA, Cortellis, Citeline)는 $100K/yr SaaS. 오픈소스 무료 도구로 같은 5축을 다루는 것 자체가 USP.

**Persona**: B2B 규제 산업 (CRO·RA·PV·바이오텍·MA·규제변호사) + 글로벌 reg professional.

## Roadmap

| Phase | 범위 |
|---|---|
| v0.1 | 한국 (MFDS · HIRA · 복지부 · KPIS) |
| v0.2 | + 한국 헬스케어 관계법령 (약사법 · 의료기기법 · 첨생법 · 국민건강보험법 등 ~8-12개) |
| v0.5 | + FDA (openFDA) |
| v1.0 | + EMA (EPAR + medicines DB) |
| v1.5 | + PMDA + NMPA (Asia bundle) |
| v2 | 의료기기 (60-70% c-level reuse) |
| v3 | DTx / AI SaMD (별도 sub-project) |

⚠️ **의료법 (Medical Practice Act)은 KoRegX scope out** — 별도 medical case law MCP 프로젝트로 분리 (`../medical-case-law-mcp-TODO.md`).

## Stack

`Next.js 16 + React 19 + Tailwind 4 + Prisma 7 + Postgres (Neon) + pgvector + Clerk + Gemini 2.5 Flash + MCP SDK`

PharmaNova scaffold fork.

## Status

- [x] Brainstorm 완료 (2026-05-07)
- [x] Design spec — `docs/superpowers/specs/2026-05-07-koregx-design.md`
- [ ] Implementation plan
- [ ] v0.1 scaffold
- [ ] v0.1 데이터 ingestion
- [ ] v0.1 web UI + MCP server
- [ ] v0.1 deploy + Claude Desktop connector

## License

MIT (배포 시점 적용).

## Author

Moon Kim ([@drmoony](https://github.com/drmoony))
