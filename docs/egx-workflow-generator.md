# EGX Workflow Generator

A modular Node.js generator for creating n8n workflow JSON files for the **EGX Deep Analyst** platform — an automated technical analysis, AI-powered stock recommendation, and Discord notification system for Egyptian EGX stock market trading.

## Features

- **Multi-step n8n workflow generation** from modular JavaScript builders
- **AI-powered analysis** using Z.ai GLM-5 endpoint with Fibonacci/Volume/Divergence confluence
- **Real-time data pipelines** — Yahoo OHLCV, Mubasher news, CBE rates, institutional flows
- **Smart Context RAG** — semantic similarity search (pgvector) of past trading sessions
- **Discord integration** — rich embeds with technical analysis, predictions, and historical accuracy
- **Automated auditing** — 24h/5d direction accuracy via dedicated auditor workflow
- **Production-ready** — error handling, retries, rate-limiting, schema validation

## Directory Structure

```
egx-workflow-generator/
├── README.md                           (this file)
├── package.json                        (npm dependencies)
├── package-lock.json
├── node_modules/
├── .env.example                        (environment template)
├── .env                                (local secrets, DO NOT COMMIT)
│
├── src/
│   ├── builders/                       (n8n node builders)
│   │   ├── aiAnalysisNode.js           (LLM analysis orchestration)
│   │   ├── dataEnrichmentNodes.js      (news, CBE, breadth, flows, compression)
│   │   ├── databaseNodes.js            (PostgreSQL schema, semantic search, auditor nodes)
│   │   ├── discordNode.js              (rich embed formatting & webhook delivery)
│   │   ├── scheduleNode.js             (cron scheduling triggers)
│   │   ├── taEngineNode.js             (technical analysis: EMA, RSI, MACD, Ichimoku, etc)
│   │   └── yahooFetchNode.js           (stock OHLCV & asset meta fetcher)
│   │
│   ├── lib/
│   │   └── utils.js                    (shared: createCodeNode, connections, ID mgmt)
│   │
│   └── scripts/
│       ├── index.js                    (main generator → EGX_Deep_Analyst.json)
│       └── generateAuditor.js          (auditor generator → EGX_Auditor.json)
│
└── output/                             (optional: place generated JSONs here)
```

## Quick Start

### 1. Install

```bash
cd /home/homeLab/egx-workflow-generator
npm install
cp .env.example .env
# Edit .env with your credentials (ZAI_API_KEY, DISCORD_WEBHOOK_URL, Postgres creds, etc.)
```

### 2. Generate Workflows

**Main workflow (EGX Deep Analyst):**
```bash
node src/scripts/index.js > ../../workflows/EGX_Deep_Analyst.json
```

**Auditor workflow (runs daily post-market):**
```bash
node src/scripts/generateAuditor.js > ../../workflows/EGX_Auditor.json
```

**Pretty-printed (for debugging):**
```bash
node src/scripts/index.js --pretty > output/EGX_Deep_Analyst_pretty.json
```

### 3. Import into n8n

- Navigate to n8n UI (http://localhost:8000)
- **Settings** → **Import Workflow**
- Paste JSON content
- Configure credentials (Postgres, Discord webhook URLs)
- **Activate** the workflow

## Environment Variables

### Required

| Variable | Purpose | Example |
|----------|---------|---------|
| `ZAI_API_KEY` | Z.ai GLM-5 endpoint token | `sk-...` |
| `DISCORD_WEBHOOK_URL` | Discord webhook for analysis reports | `https://discord.com/api/webhooks/...` |
| `POSTGRES_HOST` | Postgres DB (inside Docker: `n8n-postgres`) | `172.25.0.10` |
| `POSTGRES_PORT` | Postgres port | `5432` |
| `POSTGRES_USER` | Postgres app user | `n8n_user` |
| `POSTGRES_PASS` | Postgres app password | (from Docker init) |
| `POSTGRES_DB` | Application database name | `egx_trading` |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | Ollama embeddings endpoint (for semantic search) | `http://172.25.0.30:11434` |
| `MIN_NEWS_COUNT` | Minimum news items per stock | `3` |

See `.env.example` for full template.

## Architecture Overview

### Main Workflow (EGX Deep Analyst)

**Execution flow (daily 9:00 AM Cairo):**

1. **Stock Config** — Load tickers, fetch their metadata
2. **Yahoo Fetch** — OHLCV candles (1H, 4H, W, D)
3. **TA Engine** — Calculate 50+ indicators per timeframe
4. **Embed Market States** — Generate Ollama embeddings for RAG
5. **Smart Context Search** — Find 2 most similar past sessions via pgvector
6. **Merge Smart Context** — Attach historical decisions to current stocks
7. **Data Enrichment**:
   - **Fetch News** — 3 latest Arabic headlines per stock (Mubasher)
   - **CBE Rates** — Overnight deposit/lending rates (source: CBE API)
   - **Market Breadth** — EGX-30 + sector indices correlation
   - **Institutional Flows** — Foreign/Arab net buying/selling (EGX data)
8. **AI Analysis** — Z.ai GLM-5 JSON generation (2 retries on parse failure)
9. **Format & Send Discord** — Rich embeds, 2-per-batch, rate-limit handling
10. **Build Archive** — Store run metadata & predictions for auditing
11. **Write to Journal** — Insert prediction row into `egx_trading_journal`

### Auditor Workflow (EGX_Auditor.json)

**Runs daily 4:00 PM Cairo (post-market close):**

1. Fetch unaudited predictions from journal (created within last 24h)
2. Parallel branches:
   - **24h Accuracy**: Compare prediction_24h range vs actual close
   - **5d Accuracy**: Store prediction_5d for batch audit after 5 days
3. Update journal with `direction_accuracy_24h`, `price_accuracy_24h`, etc.
4. Send audit summary to Discord

## Key Concepts

### Fibonacci-VVP Triple Confluence

When a stock shows **all three** of these simultaneously:
1. **Fibonacci S/R level** (f618, f500, f382 ±0.5% of price)
2. **VVP Point of Control** (highest-volume price node)
3. **Institutional foreigners buying** (net > 0)

→ This is flagged as a high-conviction setup in the AI analysis & Discord embed.

### Smart Context (Semantic Memory)

The generator embeds each day's market state into pgvector, then queries for the 2 most similar past sessions. The AI receives their historical decisions, creating a feedback loop:
- If similar setup worked → boost confidence ✓
- If similar setup failed → reduce confidence ✗

### Candlestick Compression (OHLC4)

Raw OHLCV is compressed to reduce token cost to the AI:
- **Per timeframe**: last 20 candles for 1H/4H, last 10 for W/D
- **Format**: `[O,H,L,C,V,EMA,RSI]` as comma-separated string
- **Reduction**: ~80% smaller context while preserving trend structure

## Development

### Adding a New Node Builder

1. Create new file in `src/builders/myNewNode.js`
2. Export a builder function:
   ```javascript
   function buildMyNode(opts = {}) {
     const node = createCodeNode('My Node', CODE.trim(), [startX, startY]);
     return { nodes: [node], connections: {...}, lastNodeName: 'My Node' };
   }
   module.exports = { buildMyNode };
   ```
3. Import in `src/scripts/index.js` and add to workflow pipeline
4. Test: `node src/scripts/index.js > /tmp/test.json && node -e "JSON.parse(require('fs').readFileSync('/tmp/test.json'))"`

### Debugging

**Pretty-print generated workflow:**
```bash
node src/scripts/index.js --pretty | less
```

**Test individual node builder:**
```bash
node -e "const {buildMyNode} = require('./src/builders/myNewNode'); console.log(JSON.stringify(buildMyNode(), null, 2))"
```

## Troubleshooting

### "No JSON found after retry" in Discord

The AI node couldn't parse the LLM response. Check:
- **max_tokens** in `aiAnalysisNode.js` (should be 6000+)
- **System prompt** clarity — try reducing optional sections
- **ZAI_API_KEY** validity and rate limits
- **Network latency** — increase retries or timeouts

### News showing only 1 item instead of 3

The Discord embed now pulls from raw `a.news[]` (always 3 from Mubasher), not `ai.news_analysis[]` (LLM's selection). Check:
- Mubasher website is accessible
- HTTP timeouts aren't being exceeded
- No robots.txt/rate-limiting from Mubasher

### Postgres connection errors

Verify in n8n UI:
- Credential ID: `SMM23XuwjMBme4xR` (check Settings → Credentials)
- Host is reachable: `telnet 172.25.0.10 5432`
- Database exists: `psql -h 172.25.0.10 -U n8n_user -d egx_trading -c "SELECT 1"`

## References

- **n8n**: https://docs.n8n.io/
- **Mubasher API**: https://mubasher.info/ (web scraping via parseNewsList)
- **Finatra/Finagle**: Scale down complexity if adding Scala integrations
- **pgvector**: Semantic search in PostgreSQL (cosine similarity)

## License

Internal — EGX Deep Analyst Platform

---

**Last Updated:** 2026-03-20  
**Contributors:** Omar Elsahragty
