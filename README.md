## Tokscale Dashboard

**[中文文档](README.zh-CN.md)**

A powerful, beautiful analytics dashboard for tracking AI coding assistant token usage and costs. Built on top of [tokscale](https://github.com/junhoyeo/tokscale) data with a zero-dependency Node.js server and React frontend.

![Overview - Dark Mode](docs/screenshots/overview-dark.png)

## Why Tokscale Dashboard?

If you use AI coding assistants like **Cursor**, **Codex CLI**, **Claude Code**, or **Gemini CLI**, you're likely spending significant amounts on AI tokens without clear visibility. Tokscale Dashboard gives you:

- **Complete cost visibility** — Know exactly where every dollar goes across all your AI tools
- **Model-level analytics** — Compare costs, token usage, and message counts across 60+ models
- **Platform vs API pricing** — See if your platform subscription is actually saving you money compared to direct API costs
- **Beautiful share cards** — Generate stunning PNG cards to share your AI usage stats

## Screenshots

| Dark Mode | Light Mode | Pricing Comparison |
|:-:|:-:|:-:|
| ![Dark](docs/screenshots/overview-dark.png) | ![Light](docs/screenshots/overview-light.png) | ![Pricing](docs/screenshots/pricing-dark.png) |

### Share Cards

Generate beautiful PNG cards to share your AI usage stats:

| Overview Card | Streak Card | Badge Card |
|:-:|:-:|:-:|
| ![Overview](docs/screenshots/share-overview.png) | ![Streak](docs/screenshots/share-streak.png) | ![Badge](docs/screenshots/share-badge.png) |

## Quick Start

Run the dashboard directly — no clone, no install:

```bash
# With bun
bunx tokscale-dashboard

# With npm
npx tokscale-dashboard

# Custom port
npx tokscale-dashboard --port 3000
```

Then open <http://localhost:8787>.

On first launch, the dashboard will:
1. Use the bundled pre-built frontend assets
2. Create `~/.tokscale-dashboard/data/` to store graph, pricing, and settings
3. Call the `tokscale` CLI (via `bunx tokscale@latest` by default) to collect the initial data set

All data refresh and tokscale runner configuration happens in the in-app Settings panel — no external scripts needed.

## Features

### Analytics & Visualization
- **Summary Dashboard** — Total cost, tokens, messages, active days, peak day, and cache stats at a glance
- **Monthly Cost Trends** — Interactive line charts tracking cost and message volume over time
- **Monthly Breakdown** — Expandable rows showing per-model usage for each month
- **Daily Activity Heatmap** — GitHub-style contribution graph for your AI usage
- **Provider & Source Breakdown** — Pie charts showing cost distribution by provider
- **Top Models Ranking** — Ranked list of your most-used (and most expensive) models
- **Token Type Analysis** — Monthly breakdown with stacked (vertical) and grouped (horizontal) bar layouts
- **Daily Usage Charts** — Granular daily cost and token analysis, expandable by model

### Pricing Intelligence
- **Model Price List** — Real-time pricing data from LiteLLM and OpenRouter for 56+ models
- **Cost Comparison** — Platform cost vs estimated direct API cost for every model
- **Cost Ratio Analysis** — Instantly see which models are cheaper on your platform vs direct API
- **Automatic Model Mapping** — Maps platform-specific model names to their public API equivalents

### Settings & Data Refresh
- **In-app settings modal** — Configure the tokscale runner (`bunx` / `npx`), package spec (`tokscale@latest`, pinned versions, etc.), and extra CLI arguments
- **Granular refresh** — Refresh everything, token data only, or pricing only — all from the UI
- **Live log output** — See each step of the refresh as it happens

### Shareable Cards
- **9 Card Templates** — Overview, Compact, Top Models, Activity, Monthly, Providers, Tokens, Streak, Badge
- **PNG Export** — High-resolution 2x PNG download for any card

### Theming & UX
- **Dark & Light Mode** — Full theme support with persistent preference
- **Glass Morphism UI** — Modern frosted glass design with smooth animations
- **Responsive Layout** — Works on desktop and tablet
- **CSV Export** — One-click full data export

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ (zero runtime dependencies) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Image Export | html-to-image |
| Data Source | [tokscale](https://github.com/junhoyeo/tokscale) CLI |

## Local Development

```bash
git clone https://github.com/pdajoy/tokendashboard.git
cd tokendashboard

# Install frontend deps + build dist
npm run build

# Start the combined Node.js server (API + static frontend)
npm start
# Open http://localhost:8787
```

### Dev mode with hot reload

```bash
npm run dev
# Vite dev server: http://localhost:5173
# API server:     http://localhost:8787
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `8787` |
| `DATA_DIR` | Directory for `graph.json`, `pricing.json`, `settings.json` | `./data` (dev) / `~/.tokscale-dashboard/data` (installed) |
| `FRONTEND_DIR` | Built frontend directory | `./frontend/dist` |
| `API_ONLY` | Set to `1` to disable static serving (used in dev) | — |

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/models` | GET | Model usage details, derived on the fly from `graph.json` |
| `/api/monthly` | GET | Monthly summary, derived on the fly from `graph.json` |
| `/api/graph` | GET | Daily contribution data |
| `/api/pricing` | GET | Model pricing data |
| `/api/meta` | GET | Data update timestamp |
| `/api/export/csv` | GET | Export all data as CSV |
| `/api/settings` | GET/POST | Read or update settings (tokscale runner, spec, extra args) |
| `/api/refresh` | POST | Trigger data refresh. Body: `{ "target": "all" \| "graph" \| "pricing" }` |
| `/api/health` | GET | Health check |

## Project Structure

```
tokscale-dashboard/
├── scripts/
│   ├── server.mjs           # HTTP server + API routes + SPA serving
│   ├── data-utils.mjs       # JSON derivation utilities (no deps)
│   ├── data-refresh.mjs     # Internal data refresh (spawns tokscale CLI)
│   ├── pricing-resolver.mjs # LiteLLM + OpenRouter pricing resolver & cache
│   ├── settings.mjs         # Settings read/write
│   └── dev.mjs              # Dev mode launcher (Vite + API)
├── frontend/                # React app (Vite)
│   ├── src/
│   └── dist/                # Pre-built output (shipped with npm package)
├── data/                    # Runtime data (local dev)
└── docs/                    # Screenshots
```

## License

MIT

## Credits

- Data powered by [tokscale](https://github.com/junhoyeo/tokscale) by Junho Yeo
- Inspired by [token-insight](https://github.com/mo2g/token-insight)
- Pricing data from [LiteLLM](https://github.com/BerriAI/litellm) and [OpenRouter](https://openrouter.ai)
