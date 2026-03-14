# CLAUDE.md - Fraud Detection Dashboard (Next.js)

## Project Overview

A fully client-side Next.js dashboard for detecting duplicate/fraudulent retailer accounts. All clustering, similarity analysis, and risk scoring runs in the browser — no backend required. Ported from a Python/Streamlit app.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: shadcn/ui v4 (uses `@base-ui/react` internally) + Tailwind CSS v4
- **Map**: Leaflet (vanilla, dynamically imported) with CartoDB Dark Matter tiles
- **CSV parsing**: papaparse
- **Fuzzy matching**: fastest-levenshtein (implements token_sort_ratio)
- **Clustering**: custom DBSCAN implementation (no npm package) with haversine distance
- **Theme**: Dark professional (`dark` class on `<body>`)
- **Deploy**: Vercel (`npx vercel --prod`)

## Project Structure

```
fraud_dash_next/
├── app/
│   ├── layout.tsx          # Root layout — sets dark class, metadata
│   ├── page.tsx            # Main page — all state lives here
│   └── globals.css         # Tailwind + shadcn CSS vars
├── components/
│   ├── FileUpload.tsx      # Drag-and-drop CSV uploader (papaparse)
│   ├── FilterSidebar.tsx   # Darkstore/Trader/Date/Radius/MinSamples filters
│   ├── StatsBar.tsx        # Top metrics row (clusters, risk counts)
│   ├── ClusterMap.tsx      # Leaflet map — dynamically imported, SSR disabled
│   ├── ClusterTable.tsx    # Sortable cluster list with risk badges
│   └── ClusterDetail.tsx   # Side panel — retailer cards, name pairs, phone dupes
├── lib/
│   ├── types.ts            # All TypeScript interfaces
│   ├── dataProcessing.ts   # CSV validation, cleaning, filtering
│   ├── clustering.ts       # Haversine, DBSCAN, cluster stats, risk scoring
│   └── similarity.ts       # token_sort_ratio, name/phone analysis
└── components/ui/          # shadcn/ui components (button, badge, slider, etc.)
```

## Running Locally

```bash
cd ~/Documents/Projects/fraud_dash_next
npm run dev       # starts on port 3001 if 3000 is in use
npm run build     # production build check
```

## Key Architecture

### State (app/page.tsx)
All state lives in `page.tsx`:
- `rawData` — cleaned rows after CSV upload
- `filteredData` / `clusteredRows` — after running analysis
- `clusterStats` — cluster aggregates with risk scores
- `similarityResults` — name pairs + phone groups per cluster
- `selectedClusterId` — drives detail panel + map highlight

### Data Pipeline (triggered by "Run Analysis")
1. `applyFilters(rawData, filters)` — darkstore/trader/date/lastMeetingAfter
2. `clusterByGPS(filtered, radiusMeters, minSamples)` — dedup by buyerid → DBSCAN → merge cluster_id back
3. `calculateClusterStats(withClusters)` — aggregate per cluster
4. `analyzeAllClusters(withClusters)` — fuzzy name matching (≥90%) + phone dedup
5. `calculateClusterRiskScore(stats, simResults)` — 0–100 score, sorted High→Low

### Risk Scoring (lib/clustering.ts)
- Retailer count ≥5: +30, ≥3: +20, ≥2: +10
- Single trader manages all: +25
- Similar name pairs × 15, capped at 30
- Phone duplicates: +15
- High ≥60, Medium 30–59, Low <30

### DBSCAN (lib/clustering.ts)
Custom O(n²) implementation — fine for hundreds of unique buyers per upload. Uses haversine distance in meters, no radians conversion needed (formula is pure JS).

### Fuzzy Matching (lib/similarity.ts)
`tokenSortRatio(a, b)` — splits names into tokens, sorts, joins, then computes Levenshtein ratio via `fastest-levenshtein`. Equivalent to Python's `fuzz.token_sort_ratio`.

## Important Gotchas

### Leaflet + React Strict Mode
Leaflet throws "Map container is already initialized" in strict mode because effects run twice. Fix is in `ClusterMap.tsx`:
- Check `(mapRef.current as any)._leaflet_id` before initializing (Leaflet stamps this on the DOM div)
- Use a `cancelled` flag to abort async `import('leaflet')` if the effect cleanup already ran
- `ClusterMap` is always `dynamic(() => import(...), { ssr: false })` — never import directly

### shadcn Slider (v4)
Uses `@base-ui/react/slider`, not the old `@radix-ui/react-slider`. The `onValueChange` callback type is `(value: number | readonly number[]) => void`, not `number[]`. Always handle both cases:
```ts
onValueChange={(val) => {
  const v = Array.isArray(val) ? val[0] : val
  // use v
}}
```

### Leaflet CSS
Loaded via a `<link>` tag inside `ClusterMap.tsx` pointing to the unpkg CDN. Do not try to `import 'leaflet/dist/leaflet.css'` — it breaks with dynamic imports and SSR.

## Required CSV Columns
`meetingDate`, `Darkstore`, `traderName`, `traderId`, `buyerName`, `buyerid`, `buyerPhone`, `currentLatitude`, `currentLongitude`, `selfie`, `verificationDoc`

## Common Tasks

**Add a new filter**: Add field to `Filters` in `types.ts`, handle in `applyFilters()` in `dataProcessing.ts`, add UI in `FilterSidebar.tsx`, pass through `page.tsx`.

**Change risk scoring**: Edit `calculateClusterRiskScore()` in `lib/clustering.ts`.

**Update map style**: Edit tile URL or circle options in `ClusterMap.tsx`.

**Add a new chart**: Install recharts (already in deps), add component, render in `page.tsx` below the cluster table.

## Deployment

```bash
npx vercel --prod
```

No environment variables needed — fully static, client-side only.
