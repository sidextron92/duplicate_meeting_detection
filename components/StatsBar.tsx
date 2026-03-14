import type { ClusterStat } from '@/lib/types'

interface Props {
  totalRetailers: number
  clusterStats: ClusterStat[]
}

export default function StatsBar({ totalRetailers, clusterStats }: Props) {
  const high = clusterStats.filter(c => c.risk_level === 'High').length
  const medium = clusterStats.filter(c => c.risk_level === 'Medium').length
  const low = clusterStats.filter(c => c.risk_level === 'Low').length
  const clustered = clusterStats.reduce((sum, c) => sum + c.retailer_count, 0)

  const stats = [
    { label: 'Retailers', value: totalRetailers, color: 'text-zinc-200' },
    { label: 'Clusters', value: clusterStats.length, color: 'text-blue-400' },
    { label: 'High Risk', value: high, color: 'text-red-400' },
    { label: 'Medium Risk', value: medium, color: 'text-yellow-400' },
    { label: 'Low Risk', value: low, color: 'text-green-400' },
    { label: 'Clustered', value: clustered, color: 'text-purple-400' },
  ]

  return (
    <div className="grid grid-cols-6 gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
      {stats.map(s => (
        <div key={s.label} className="bg-zinc-800 rounded-lg px-3 py-2 text-center">
          <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          <div className="text-zinc-400 text-xs mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}
