'use client'

import { useEffect } from 'react'
import Papa from 'papaparse'
import type { DuplicateEntry } from '@/lib/types'

interface Props {
  entries: DuplicateEntry[]
  onClose: () => void
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  return `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`
}

export default function DuplicatesModal({ entries, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function handleExport() {
    const rows = entries.map(e => ({
      duplicate_id: e.duplicate_id,
      cluster_id: e.cluster_id,
      buyerid: e.buyerid,
      buyerName: e.buyerName,
      buyerPhone: e.buyerPhone,
      traderName: e.traderName,
      Darkstore: e.Darkstore,
      meetingDate: e.meetingDate,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'marked_duplicates.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group entries by duplicate_id for display
  const groups = entries.reduce<Record<string, DuplicateEntry[]>>((acc, e) => {
    if (!acc[e.duplicate_id]) acc[e.duplicate_id] = []
    acc[e.duplicate_id].push(e)
    return acc
  }, {})

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-[90vw] max-w-5xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div>
            <p className="text-white font-semibold">Marked Duplicates</p>
            <p className="text-zinc-400 text-xs">
              {Object.keys(groups).length} group{Object.keys(groups).length !== 1 ? 's' : ''} · {entries.length} buyers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded transition-colors"
            >
              Export CSV
            </button>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 p-4">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-900">
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-2 px-2">Duplicate ID</th>
                <th className="text-left py-2 px-2">Cluster</th>
                <th className="text-left py-2 px-2">Buyer ID</th>
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Phone</th>
                <th className="text-left py-2 px-2">Trader</th>
                <th className="text-left py-2 px-2">Darkstore</th>
                <th className="text-left py-2 px-2">Meeting Date</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([dupId, groupEntries], gi) =>
                groupEntries.map((e, i) => (
                  <tr
                    key={`${dupId}-${e.buyerid}`}
                    className={`border-b border-zinc-800/50 text-zinc-300 ${
                      gi % 2 === 0 ? 'bg-zinc-800/20' : ''
                    }`}
                  >
                    {/* Show duplicate_id only on first row of group */}
                    <td className="py-1.5 px-2 font-mono text-orange-400 text-[10px] max-w-[140px] truncate">
                      {i === 0 ? dupId : ''}
                    </td>
                    <td className="py-1.5 px-2 text-zinc-400">{e.cluster_id}</td>
                    <td className="py-1.5 px-2 font-mono">{e.buyerid}</td>
                    <td className="py-1.5 px-2">{e.buyerName}</td>
                    <td className="py-1.5 px-2 font-mono">{e.buyerPhone || '—'}</td>
                    <td className="py-1.5 px-2">{e.traderName}</td>
                    <td className="py-1.5 px-2">{e.Darkstore}</td>
                    <td className="py-1.5 px-2">{fmtDate(e.meetingDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
