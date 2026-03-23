# Tokscale Dashboard

**[中文文档](README.zh-CN.md)**

A powerful, beautiful analytics dashboard for tracking AI coding assistant token usage and costs. Built on top of [tokscale](https://github.com/junhoyeo/tokscale) data with a Go backend and React frontend.

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

## Features

### Analytics & Visualization
- **Summary Dashboard** — Total cost, tokens, messages, active days, peak day, and cache stats at a glance
- **Monthly Cost Trends** — Interactive line charts tracking cost and message volume over time
- **Daily Activity Heatmap** — GitHub-style contribution graph for your AI usage
- **Provider & Source Breakdown** — Pie charts showing cost distribution by provider (Anthropic, OpenAI, Google, etc.)
- **Top Models Ranking** — Ranked list of your most-used (and most expensive) models
- **Token Type Analysis** — Monthly breakdown of Input, Output, Cache Read, Cache Write, and Reasoning tokens
- **Daily Usage Charts** — Granular daily cost and token analysis

### Pricing Intelligence
- **Model Price List** — Real-time pricing data from LiteLLM and OpenRouter for 56+ models
- **Cost Comparison** — Platform cost vs estimated direct API cost for every model
- **Cost Ratio Analysis** — Instantly see which models are cheaper on your platform vs direct API
- **Automatic Model Mapping** — Maps platform-specific model names to their public API equivalents

### Advanced Filtering
- **Multi-dimensional Filters** — Filter by Source, Provider, Model, date range, and minimum cost
- **Quick Date Presets** — One-click presets for 7d, 30d, this month, last month, 6m, 1y
- **Search** — Full-text search across models and providers
- **Real-time Updates** — All charts and tables update instantly when filters change

### Shareable Cards
- **9 Card Templates** — Overview, Compact, Top Models, Activity, Monthly, Providers, Tokens, Streak, Badge
- **PNG Export** — High-resolution 2x PNG download for any card
- **Dark-themed Cards** — All cards render with a premium dark aesthetic for sharing
- **Rank System** — Badge card features a rank from Starter to Legend based on total spend

### Theming & UX
- **Dark & Light Mode** — Full theme support with persistent preference
- **Glass Morphism UI** — Modern frosted glass design with smooth animations
- **Responsive Layout** — Works on desktop and tablet
- **CSV Export** — One-click full data export
- **One-click Data Refresh** — Re-collect latest data from tokscale CLI

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go (standard library, zero dependencies) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Image Export | html-to-image |
| Data Source | [tokscale](https://github.com/junhoyeo/tokscale) CLI |

## Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+ and npm
- [Bun](https://bun.sh) (for tokscale CLI data collection)

### Setup

```bash
# Clone the repository
git clone https://github.com/pdajoy/tokendashboard.git
cd tokendashboard

# Build everything (Go backend + React frontend)
bash scripts/build.sh

# Collect data (requires tokscale CLI)
bash scripts/update-data.sh

# Start the dashboard
bash scripts/start.sh
# Open http://localhost:8787
```

### Development Mode

```bash
# Start Go backend + React dev server with hot reload
bash scripts/dev.sh
# Open http://localhost:5173
```

### Generate Pricing Data

```bash
# The pricing data is auto-generated from tokscale CLI
# It queries LiteLLM and OpenRouter for real-time model pricing
# The pricing.json file is served via /api/pricing
```

## Scripts

| Script | Description |
|---|---|
| `scripts/build.sh` | Build Go backend + React frontend |
| `scripts/update-data.sh` | Collect latest data via tokscale CLI |
| `scripts/start.sh` | Start production server (auto-builds if needed) |
| `scripts/dev.sh` | Start development mode with hot reload |

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/models` | GET | Model usage details |
| `/api/monthly` | GET | Monthly summary |
| `/api/graph` | GET | Daily contribution data |
| `/api/pricing` | GET | Model pricing data |
| `/api/meta` | GET | Data update timestamp |
| `/api/export/csv` | GET | Export all data as CSV |
| `/api/refresh` | POST | Trigger data refresh |
| `/api/health` | GET | Health check |

## Project Structure

```
tokscale-dashboard/
├── backend/              # Go backend server
│   ├── go.mod
│   └── main.go           # HTTP server, API routes, CORS
├── frontend/             # React frontend
│   ├── src/
│   │   ├── App.tsx        # Main app with tabs and routing
│   │   ├── api.ts         # API client
│   │   ├── components/    # All UI components
│   │   │   ├── SummaryCards.tsx
│   │   │   ├── MonthlyChart.tsx
│   │   │   ├── DailyChart.tsx
│   │   │   ├── ProviderChart.tsx
│   │   │   ├── TokenBreakdown.tsx
│   │   │   ├── ContributionHeatmap.tsx
│   │   │   ├── TopModels.tsx
│   │   │   ├── ModelTable.tsx
│   │   │   ├── MonthlyTable.tsx
│   │   │   ├── DailyTable.tsx
│   │   │   ├── FilterPanel.tsx
│   │   │   ├── PricingTable.tsx
│   │   │   └── ShareCard.tsx
│   │   ├── hooks/         # Custom React hooks
│   │   │   ├── useData.ts
│   │   │   └── useTheme.tsx
│   │   └── types/         # TypeScript interfaces
│   └── dist/              # Production build output
├── data/                  # tokscale JSON data files
│   ├── models.json
│   ├── monthly.json
│   ├── graph.json
│   ├── pricing.json
│   └── meta.json
├── docs/                  # Documentation and screenshots
├── scripts/               # Build and management scripts
└── bin/                   # Compiled Go binary
```

## License

MIT

## Credits

- Data powered by [tokscale](https://github.com/junhoyeo/tokscale) by Junho Yeo
- Pricing data from [LiteLLM](https://github.com/BerriAI/litellm) and [OpenRouter](https://openrouter.ai)
