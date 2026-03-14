'use client'

import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import FileUpload from '@/components/FileUpload'
import FilterSidebar from '@/components/FilterSidebar'
import StatsBar from '@/components/StatsBar'
import ClusterTable from '@/components/ClusterTable'
import ClusterDetail from '@/components/ClusterDetail'
import DuplicatesModal from '@/components/DuplicatesModal'
import { applyFilters, getFilterOptions } from '@/lib/dataProcessing'
import { clusterByGPS, calculateClusterStats, calculateClusterRiskScore } from '@/lib/clustering'
import { analyzeAllClusters } from '@/lib/similarity'
import type { Row, Filters, FilterOptions, ClusterStat, SimilarityMap, AppConfig, DuplicateEntry } from '@/lib/types'

const ClusterMap = dynamic(() => import('@/components/ClusterMap'), { ssr: false })

export default function Home() {
  const [rawData, setRawData] = useState<Row[] | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ darkstores: [], traders: [], dateRange: ['', ''] })
  const [filters, setFilters] = useState<Filters>({ darkstores: [], traders: [], dateRange: null, lastMeetingAfter: null })
  const [config, setConfig] = useState<AppConfig>({ radiusMeters: 10, minSamples: 2 })
  const [clusterStats, setClusterStats] = useState<ClusterStat[]>([])
  const [clusteredRows, setClusteredRows] = useState<Row[]>([])
  const [similarityResults, setSimilarityResults] = useState<SimilarityMap>({})
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerWidthPct, setDrawerWidthPct] = useState(45)
  const [markedDuplicates, setMarkedDuplicates] = useState<DuplicateEntry[]>([])
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false)
  const isDragging = useRef(false)

  function onDragHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return
      const pct = ((window.innerWidth - ev.clientX) / window.innerWidth) * 100
      setDrawerWidthPct(Math.min(80, Math.max(30, pct)))
    }

    function onMouseUp() {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // ESC closes the drawer (only when no modal/viewer is open — those handle ESC themselves first)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedClusterId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleDataLoaded(rows: Row[]) {
    setRawData(rows)
    const opts = getFilterOptions(rows)
    setFilterOptions(opts)
    setFilters(prev => ({
      ...prev,
      dateRange: opts.dateRange[0] ? [opts.dateRange[0], opts.dateRange[1]] : null,
    }))
    setClusterStats([])
    setClusteredRows([])
    setSimilarityResults({})
    setSelectedClusterId(null)
    setMarkedDuplicates([])
  }

  const runAnalysis = useCallback(() => {
    if (!rawData) return
    setRunning(true)

    setTimeout(() => {
      const filtered = applyFilters(rawData, filters)
      const withClusters = clusterByGPS(filtered, config.radiusMeters, config.minSamples)
      const stats = calculateClusterStats(withClusters)
      const simResults = analyzeAllClusters(withClusters)
      const scoredStats = calculateClusterRiskScore(stats, simResults)
        .sort((a, b) => b.risk_score - a.risk_score)

      setClusteredRows(withClusters)
      setClusterStats(scoredStats)
      setSimilarityResults(simResults)
      setSelectedClusterId(null)
      setRunning(false)
    }, 10)
  }, [rawData, filters, config])

  function handleMarkDuplicates(entries: DuplicateEntry[]) {
    setMarkedDuplicates(prev => [...prev, ...entries])
  }

  function handleExport() {
    if (clusterStats.length === 0) return
    const rows = clusterStats.map(s => ({
      cluster_id: s.cluster_id,
      retailer_count: s.retailer_count,
      trader_count: s.trader_count,
      risk_score: s.risk_score,
      risk_level: s.risk_level,
      center_lat: s.center_lat,
      center_lon: s.center_lon,
      retailer_names: s.retailer_names.join(' | '),
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fraud_clusters.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!rawData) {
    return <FileUpload onDataLoaded={handleDataLoaded} />
  }

  const markedBuyerIdsForCluster = selectedClusterId !== null
    ? new Set(markedDuplicates.filter(e => e.cluster_id === selectedClusterId).map(e => e.buyerid))
    : new Set<string>()

  const uniqueRetailers = new Set(rawData.map(r => r.buyerid)).size
  const filteredRetailers = clusteredRows.length > 0
    ? new Set(clusteredRows.map(r => r.buyerid)).size
    : uniqueRetailers

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <h1 className="text-lg font-bold tracking-tight">Fraud Detection Dashboard</h1>
        <div className="flex items-center gap-3">
          {markedDuplicates.length > 0 && (
            <button
              onClick={() => setShowDuplicatesModal(true)}
              className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded transition-colors font-medium"
            >
              Duplicates ({markedDuplicates.length})
            </button>
          )}
          <button
            onClick={() => setRawData(null)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ↑ Upload new file
          </button>
        </div>
      </header>

      {/* Stats */}
      {clusterStats.length > 0 && (
        <StatsBar totalRetailers={filteredRetailers} clusterStats={clusterStats} />
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <FilterSidebar
          filterOptions={filterOptions}
          filters={filters}
          config={config}
          onFiltersChange={setFilters}
          onConfigChange={setConfig}
          onRun={runAnalysis}
          onExport={handleExport}
          running={running}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        />

        {/* Content area — scrollable vertically */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {clusterStats.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-500">
              <div className="text-center">
                <p className="text-lg">Configure filters and click <strong className="text-zinc-300">Run Analysis</strong></p>
                <p className="text-sm mt-1">{uniqueRetailers.toLocaleString()} unique retailers loaded</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Map — tall fixed height */}
              <div className="h-[72vh] p-3 border-b border-zinc-800 shrink-0">
                <ClusterMap
                  clusterStats={clusterStats}
                  selectedClusterId={selectedClusterId}
                  onClusterSelect={id => setSelectedClusterId(prev => prev === id ? null : id)}
                />
              </div>

              {/* Cluster table — below map, natural height, scroll handled by main */}
              <div className="p-0">
                <ClusterTable
                  clusterStats={clusterStats}
                  selectedClusterId={selectedClusterId}
                  onSelect={id => setSelectedClusterId(prev => prev === id ? null : id)}
                />
              </div>
            </div>
          )}
        </main>

        {/* Right Drawer — fixed overlay so it renders above Leaflet's stacking context */}
        <div
          className={`fixed top-0 right-0 h-screen bg-zinc-900 border-l border-zinc-800 flex flex-col
            transition-transform duration-300 ease-in-out
            ${selectedClusterId !== null ? 'translate-x-0' : 'translate-x-full'}`}
          style={{ width: `${drawerWidthPct}%`, zIndex: 1000 }}
        >
          {/* Drag handle */}
          <div
            onMouseDown={onDragHandleMouseDown}
            className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize hover:bg-zinc-600 transition-colors z-10"
            style={{ marginLeft: '-3px' }}
          />
          {selectedClusterId !== null && (
            <ClusterDetail
              clusterId={selectedClusterId}
              clusterStat={clusterStats.find(c => c.cluster_id === selectedClusterId)!}
              allRows={clusteredRows}
              similarityResults={similarityResults}
              onClose={() => setSelectedClusterId(null)}
              markedBuyerIds={markedBuyerIdsForCluster}
              onMarkDuplicates={handleMarkDuplicates}
            />
          )}
        </div>
      </div>

      {/* Duplicates Modal */}
      {showDuplicatesModal && (
        <DuplicatesModal
          entries={markedDuplicates}
          onClose={() => setShowDuplicatesModal(false)}
        />
      )}
    </div>
  )
}
