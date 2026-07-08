# Japan Company Leads Finder MCP — 日本企業リード検索

**B2B lead generation for the Japanese market, powered by official government data.**

Search over 1 million Japanese companies by size, capital, location, founding year — and a signal you won't find anywhere else: **government subsidy history**. Built on METI's official gBizINFO database. 100% legal, no scraping, no stale data.

## Why this server?

Prospecting in Japan is notoriously hard for AI agents: no LinkedIn culture, Japanese-only registries, fragmented data. This server gives your sales agent direct access to the government's own company database — including representative names, employee counts, business summaries, and public funding records.

**The killer signal:** a company that received an IT-adoption or facility-investment subsidy has budget, ambition, and a documented modernization agenda. That's a warm lead, certified by the government.

## Tools

### `search_companies`
Filter by prefecture, employee count, capital, founding year, and subsidy history. Returns corporate numbers for drill-down.

### `get_company_profile`
Representative name & title, employee count, capital, establishment date, business summary, company URL, and government procurement qualification grade.

### `get_company_subsidies`
Full history of national subsidies received — dates, program names, granting ministries.

### `get_company_procurement`
Government contract track record — for supplier vetting and public-sector sales intelligence.

## Example queries your agent can now answer

- "Build a list of Tokyo companies, 10–100 employees, that received government subsidies — with CEO names and websites"
- 「大阪府の製造業で設備投資系の補助金を受給した会社を20社、代表者名付きでリストaップして」
- "Vet this supplier: what's their government contract history?"

## Data source & freshness

Official gBizINFO REST API (Ministry of Economy, Trade and Industry, Japan), fetched live on every call.

## Pricing

Pay per tool call ($0.02). One search, profile, subsidy, or procurement lookup = one event. A 50-company lead list with full profiles ≈ $1.

---

### 日本語

経産省gBizINFOの公式データで、日本企業の営業リードをAIエージェントから検索できるMCPサーバーです。都道府県・従業員数・資本金・**補助金受給歴**での絞り込み、代表者名・事業概要・会社URL・官公庁取引実績の取得に対応。スクレイピング不使用・完全合法のB2B営業インフラです。

## Get started

Hosted MCP server on Apify Store:

👉 **https://apify.com/plus-synergy/japan-company-leads-mcp**

---
*Built by [Plus Synergy](https://apify.com/plus-synergy) — Japanese data infrastructure for AI agents.*
