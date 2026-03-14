'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { ClusterStat } from '@/lib/types'

interface Props {
  clusterStats: ClusterStat[]
  selectedClusterId: number | null
  onSelect: (id: number) => void
}

const RISK_BADGE: Record<string, string> = {
  High: 'bg-red-900/50 text-red-400 border-red-800',
  Medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  Low: 'bg-green-900/50 text-green-400 border-green-800',
}

type SortKey = 'cluster_id' | 'retailer_count' | 'risk_score' | 'trader_count'

export default function ClusterTable({ clusterStats, selectedClusterId, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('risk_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...clusterStats].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey]
    return sortDir === 'asc' ? diff : -diff
  })

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
            {([['cluster_id', '#'], ['retailer_count', 'Retailers'], ['trader_count', 'Traders'], ['risk_score', 'Risk Score']] as [SortKey, string][]).map(([k, label]) => (
              <th
                key={k}
                onClick={() => toggleSort(k)}
                className="px-3 py-2 text-left cursor-pointer hover:text-zinc-200 select-none"
              >
                {label}<SortIcon k={k} />
              </th>
            ))}
            <th className="px-3 py-2 text-left text-xs text-zinc-400">Risk</th>
            <th className="px-3 py-2 text-left text-xs text-zinc-400">Names</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(stat => (
            <tr
              key={stat.cluster_id}
              onClick={() => onSelect(stat.cluster_id)}
              className={`border-b border-zinc-800/50 cursor-pointer transition-colors
                ${selectedClusterId === stat.cluster_id ? 'bg-zinc-700' : 'hover:bg-zinc-800/50'}`}
            >
              <td className="px-3 py-2 text-zinc-400 font-mono">{stat.cluster_id}</td>
              <td className="px-3 py-2 text-zinc-200">{stat.retailer_count}</td>
              <td className="px-3 py-2 text-zinc-200">{stat.trader_count}</td>
              <td className="px-3 py-2 text-zinc-200 font-mono">{stat.risk_score}</td>
              <td className="px-3 py-2">
                <Badge className={`text-xs border ${RISK_BADGE[stat.risk_level]}`}>
                  {stat.risk_level}
                </Badge>
              </td>
              <td className="px-3 py-2 text-zinc-400 text-xs max-w-[180px] truncate">
                {stat.retailer_names.slice(0, 2).join(', ')}
                {stat.retailer_names.length > 2 && ` +${stat.retailer_names.length - 2}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
