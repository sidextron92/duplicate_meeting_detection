'use client'

import { Slider } from '@/components/ui/slider'
import type { Filters, FilterOptions, AppConfig } from '@/lib/types'

interface Props {
  filterOptions: FilterOptions
  filters: Filters
  config: AppConfig
  onFiltersChange: (f: Filters) => void
  onConfigChange: (c: AppConfig) => void
  onRun: () => void
  onExport: () => void
  running: boolean
  collapsed: boolean
  onToggleCollapse: () => void
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val])
  }

  return (
    <div className="max-h-36 overflow-y-auto rounded border border-zinc-700 bg-zinc-900">
      {options.length === 0 ? (
        <p className="text-zinc-500 text-xs px-2 py-1">{placeholder}</p>
      ) : (
        options.map(opt => (
          <label key={opt} className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-800 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="accent-blue-500"
            />
            <span className="text-zinc-300 text-xs truncate">{opt}</span>
          </label>
        ))
      )}
    </div>
  )
}

export default function FilterSidebar({
  filterOptions,
  filters,
  config,
  onFiltersChange,
  onConfigChange,
  onRun,
  onExport,
  running,
  collapsed,
  onToggleCollapse,
}: Props) {
  if (collapsed) {
    return (
      <aside className="w-11 shrink-0 flex flex-col items-center py-3 gap-4 bg-zinc-900 border-r border-zinc-800">
        {/* Expand button */}
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Filter icon */}
        <button title="Filters" className="text-zinc-500 hover:text-zinc-300 transition-colors" onClick={onToggleCollapse}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 6h18M7 12h10M11 18h2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Run icon */}
        <button
          onClick={onRun}
          disabled={running}
          title="Run Analysis"
          className="text-blue-400 hover:text-blue-300 disabled:text-zinc-600 transition-colors"
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3l14 9-14 9V3z" />
          </svg>
        </button>

        {/* Export icon */}
        <button onClick={onExport} title="Export CSV" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 16l4-4h-3V4h-2v8H8l4 4z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 20H4" strokeLinecap="round" />
          </svg>
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-4 p-4 bg-zinc-900 border-r border-zinc-800 overflow-y-auto">
      {/* Collapse button */}
      <div className="flex items-center justify-between">
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Filters</h2>
        <button
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Darkstore</label>
        <MultiSelect
          options={filterOptions.darkstores}
          selected={filters.darkstores}
          onChange={v => onFiltersChange({ ...filters, darkstores: v })}
          placeholder="All darkstores"
        />
      </div>

      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Trader</label>
        <MultiSelect
          options={filterOptions.traders}
          selected={filters.traders}
          onChange={v => onFiltersChange({ ...filters, traders: v })}
          placeholder="All traders"
        />
      </div>

      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Date From</label>
        <input
          type="date"
          value={filters.dateRange?.[0] ?? ''}
          onChange={e =>
            onFiltersChange({
              ...filters,
              dateRange: [e.target.value, filters.dateRange?.[1] ?? ''],
            })
          }
          className="w-full bg-zinc-800 text-zinc-200 text-xs rounded border border-zinc-700 px-2 py-1"
        />
      </div>

      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Date To</label>
        <input
          type="date"
          value={filters.dateRange?.[1] ?? ''}
          onChange={e =>
            onFiltersChange({
              ...filters,
              dateRange: [filters.dateRange?.[0] ?? '', e.target.value],
            })
          }
          className="w-full bg-zinc-800 text-zinc-200 text-xs rounded border border-zinc-700 px-2 py-1"
        />
      </div>

      <div>
        <label className="text-zinc-400 text-xs mb-1 block">Last Meeting After</label>
        <input
          type="date"
          value={filters.lastMeetingAfter ?? ''}
          onChange={e =>
            onFiltersChange({ ...filters, lastMeetingAfter: e.target.value || null })
          }
          className="w-full bg-zinc-800 text-zinc-200 text-xs rounded border border-zinc-700 px-2 py-1"
        />
      </div>

      <hr className="border-zinc-800" />

      <div>
        <h2 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">Clustering</h2>

        <label className="text-zinc-400 text-xs mb-2 block">
          Radius: <span className="text-zinc-200">{config.radiusMeters}m</span>
        </label>
        <Slider
          min={5}
          max={200}
          step={5}
          value={[config.radiusMeters]}
          onValueChange={(val) => {
            const v = Array.isArray(val) ? val[0] : val
            onConfigChange({ ...config, radiusMeters: v as number })
          }}
          className="mb-4"
        />

        <label className="text-zinc-400 text-xs mb-2 block">
          Min Samples: <span className="text-zinc-200">{config.minSamples}</span>
        </label>
        <Slider
          min={2}
          max={10}
          step={1}
          value={[config.minSamples]}
          onValueChange={(val) => {
            const v = Array.isArray(val) ? val[0] : val
            onConfigChange({ ...config, minSamples: v as number })
          }}
        />
      </div>

      <hr className="border-zinc-800" />

      <button
        onClick={onRun}
        disabled={running}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
      >
        {running ? 'Running...' : 'Run Analysis'}
      </button>

      <button
        onClick={onExport}
        className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm rounded-lg py-2 transition-colors"
      >
        Export CSV
      </button>
    </aside>
  )
}
