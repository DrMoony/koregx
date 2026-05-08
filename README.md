# KoRegX

> **Korean healthcare regulatory law & interpretation reference.**
> 한국 헬스케어 법령 본문 + 법제처 행정해석 + 식약처·복지부 행정규칙 + HIRA 약평위·암질심 결정 통합 인터페이스.

**Status**: v0.2 LIVE — https://koregx.vercel.app

## What

5 datasets cross-linked:
- **법령** (Law): 29 헬스케어 법령 본법 + 시행령 + 시행규칙 (약사법·의료기기법·첨단재생의료법·국민건강보험법·마약류관리법·희귀질환관리법·혁신의료기기법)
- **조문** (LawArticle): 1,746 조문 단위
- **행정해석** (LegalInterpretation): 83 법제처 회신례 (헬스케어 관계법령 의제)
- **행정규칙** (AdminRule): 124 식약처·복지부 고시·예규·훈령
- **HIRA 결정** (HiraDecision): 20 약평위 + 암질심 결정 (2024-2025)

## Why

상용 도구 (IQVIA, Cortellis, Citeline) = $100K/yr 약물 catalog 위주. 하지만 reg professional, 변호사, MA·RA가 진짜 매일 다루는 건 **"이 법조항이 어떻게 해석됐고 어떤 고시로 구체화됐나"**. KoRegX는 그 질문에 한 번에 답하는 오픈소스 도구.

## Killer query

> "약사법 제38조에 대한 법제처 행정해석 + 관련 식약처 고시 통합 chain"

→ Web UI: `/laws/<lawId>/articles/38` → 본문 + 자동 cross-link list  
→ MCP: `chain_law_lifecycle({lawShortName: "약사법", articleNo: "38"})` → JSON dossier

## Surfaces

- **Web UI**: https://koregx.vercel.app
- **MCP server**: https://koregx.vercel.app/api/mcp (9 tools)
- (선택) REST API: 향후 v0.3+

## MCP Connector

### Claude Desktop

`%APPDATA%\Claude\claude_desktop_config.json` (Windows) 또는 `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "koregx": {
      "url": "https://koregx.vercel.app/api/mcp"
    }
  }
}
```

Restart Claude Desktop. Try: "약사법 제38조에 대한 행정해석 chain 보여줘" — KoRegX 도구 자동 호출.

### claude.ai (Web)

Settings → Connectors → Add custom connector → URL: `https://koregx.vercel.app/api/mcp`

### MCP tools (9)

**Search (4)**
- `search_law(query, category?, agencyName?)` — 법령 검색
- `search_interpretation(query, lawShortName?, dateFrom?, dateTo?)` — 행정해석 검색 ⭐ USP
- `search_admin_rule(query, agency?, ruleType?)` — 행정규칙 검색
- `search_hira_decision(query, body?, dateFrom?, dateTo?)` — HIRA 약평위/암질심

**Lookup (3)**
- `get_law_article(lawShortName, articleNo, articleSubNo?)` — 조문 단일
- `get_interpretation(id)` — 행정해석 본문
- `get_admin_rule(id)` — 행정규칙 본문

**Chain (2)**
- `chain_law_lifecycle(lawShortName, articleNo)` ⭐ — 조문 + 행정해석 + 행정규칙 통합 dossier
- `chain_natural_query(query)` — 자연어 Q&A (Gemini-backed, 의미검색 + verify_citations)

## Roadmap

| Phase | 범위 | Status |
|---|---|---|
| v0.2 | 법령 + 행정해석 + 행정규칙 + HIRA + LLM Q&A + MCP | **LIVE** |
| v0.3 | LLM Q&A 강화 (citation 추출 정밀화), 식약처 자체 유권해석 정식 scrape | TODO |
| v0.5 | FDA 21 CFR cross-mapping (한국 약사법 ↔ 미국 federal regulations) | TODO |
| v1.0 | EU MDR + 한국 의료기기법 cross-mapping | TODO |
| v1.5 | PMDA 행정해석 (Asia bundle) | TODO |

⚠️ **OUT of scope**: 약물 catalog (commodity, IQVIA/openFDA에서 무료 가능), 의료법/의료 판례 (별도 medical case law MCP 프로젝트로 분리)

## Local Development

Prerequisites:
- Node 20+
- Neon Postgres (free tier OK) — pgvector extension enabled
- Clerk account (free tier)
- 법제처 OpenAPI OC (무료 발급, https://open.law.go.kr)
- (선택) Gemini API key — chain_natural_query LLM 기능에만 필요

```bash
git clone https://github.com/DrMoony/koregx.git
cd koregx
npm install
cp .env.example .env.local
# Fill in .env.local
npx prisma migrate deploy
npm run ingest:law          # 법제처 source ingest (29 laws + expc + admrul)
npm run ingest:hira         # HIRA scrape (20 decisions)
npm run embed:corpus        # (선택) Gemini embedding for semantic search
npm run dev -- --port 3300
```

Visit http://localhost:3300

### Required env vars (`.env.local`)

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...
LAW_OC=<your-법제처-oc-key>
GEMINI_API_KEY=...    # optional (chain_natural_query LLM)
```

### API key sources

- 법제처 OpenAPI: https://open.law.go.kr (무료 OC 발급)
- Clerk: https://dashboard.clerk.com
- Neon: https://console.neon.tech (pgvector enable in Settings → Extensions)
- Gemini: https://aistudio.google.com/apikey

## Tests

```bash
npm test                    # unit + integration (~80 tests)
npm run e2e                 # Playwright (~9 tests against local dev)
E2E_BASE_URL=https://koregx.vercel.app npm run e2e   # production e2e
```

## Tech Stack

`Next.js 16 + React 19 + Tailwind 4 + shadcn/ui + Prisma 7 + Postgres + pgvector + Clerk + Gemini 2.5 Flash + @modelcontextprotocol/sdk`

## License

MIT

## Author

Moon Kim ([@DrMoony](https://github.com/DrMoony))
