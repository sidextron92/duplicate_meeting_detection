import type { Row, ClusterStat, SimilarityMap } from './types'

const EARTH_RADIUS_M = 6371000

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

function dbscan(
  points: { lat: number; lon: number }[],
  epsMeterss: number,
  minSamples: number
): number[] {
  const n = points.length
  const labels = new Array<number>(n).fill(-1)
  let clusterId = 0

  const neighbors = (idx: number): number[] => {
    const result: number[] = []
    for (let i = 0; i < n; i++) {
      if (i !== idx) {
        const d = haversineDistance(points[idx].lat, points[idx].lon, points[i].lat, points[i].lon)
        if (d <= epsMeterss) result.push(i)
      }
    }
    return result
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue
    const nbrs = neighbors(i)
    if (nbrs.length + 1 < minSamples) continue // noise for now

    labels[i] = clusterId
    const queue = [...nbrs]

    while (queue.length > 0) {
      const q = queue.shift()!
      if (labels[q] === -1) {
        labels[q] = clusterId
        const qNbrs = neighbors(q)
        if (qNbrs.length + 1 >= minSamples) {
          for (const nb of qNbrs) {
            if (labels[nb] === -1) queue.push(nb)
          }
        }
      } else if (labels[q] < 0) {
        labels[q] = clusterId
      }
    }
    clusterId++
  }

  return labels
}

export function clusterByGPS(rows: Row[], radiusMeters: number, minSamples: number): Row[] {
  if (rows.length === 0) return rows

  // Count meetings per buyerid+traderId pair
  const meetingCount: Record<string, number> = {}
  for (const r of rows) {
    const key = `${r.buyerid}::${r.traderId}`
    meetingCount[key] = (meetingCount[key] ?? 0) + 1
  }

  // Deduplicate by buyerid+traderId — keep most recent meeting
  const latestByPair: Record<string, Row> = {}
  for (const r of rows) {
    const key = `${r.buyerid}::${r.traderId}`
    const existing = latestByPair[key]
    if (!existing || r.meetingDate > existing.meetingDate) {
      latestByPair[key] = r
    }
  }
  const unique = Object.values(latestByPair)

  // Run DBSCAN on unique buyerid+traderId pairs
  const points = unique.map(r => ({ lat: r.currentLatitude, lon: r.currentLongitude }))
  const labels = dbscan(points, radiusMeters, minSamples)

  // Map buyerid+traderId → cluster_id
  const pairCluster: Record<string, number> = {}
  unique.forEach((r, i) => {
    const key = `${r.buyerid}::${r.traderId}`
    pairCluster[key] = labels[i]
  })

  // Merge back into all rows
  return rows.map(r => {
    const key = `${r.buyerid}::${r.traderId}`
    return {
      ...r,
      cluster_id: pairCluster[key] ?? -1,
      meeting_count: meetingCount[key] ?? 1,
    }
  })
}

export function calculateClusterStats(rows: Row[]): ClusterStat[] {
  const clustered = rows.filter(r => (r.cluster_id ?? -1) >= 0)
  if (clustered.length === 0) return []

  // Deduplicate by buyerid+traderId within each cluster
  const seen = new Set<string>()
  const uniqueRows: Row[] = []
  for (const r of clustered) {
    const key = `${r.cluster_id}:${r.buyerid}::${r.traderId}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueRows.push(r)
    }
  }

  const byCluster: Record<number, Row[]> = {}
  for (const r of uniqueRows) {
    const cid = r.cluster_id!
    if (!byCluster[cid]) byCluster[cid] = []
    byCluster[cid].push(r)
  }

  return Object.entries(byCluster).map(([cid, clusterRows]) => {
    const lats = clusterRows.map(r => r.currentLatitude)
    const lons = clusterRows.map(r => r.currentLongitude)
    const traders = new Set(clusterRows.map(r => r.traderName))

    return {
      cluster_id: parseInt(cid),
      retailer_count: clusterRows.length,
      trader_count: traders.size,
      retailer_names: clusterRows.map(r => r.buyerName),
      phone_numbers: clusterRows.map(r => r.buyerPhone),
      center_lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      center_lon: lons.reduce((a, b) => a + b, 0) / lons.length,
      risk_score: 0,
      risk_level: 'Low',
    }
  })
}

export function calculateClusterRiskScore(
  clusterStats: ClusterStat[],
  similarityResults: SimilarityMap
): ClusterStat[] {
  return clusterStats.map(stat => {
    let score = 0

    // Factor 1: retailer count
    if (stat.retailer_count >= 5) score += 30
    else if (stat.retailer_count >= 3) score += 20
    else if (stat.retailer_count >= 2) score += 10

    // Factor 2: single trader
    if (stat.trader_count === 1) score += 25

    // Factor 3: name similarity
    const key = `cluster_${stat.cluster_id}`
    const sim = similarityResults[key]
    if (sim) {
      score += Math.min(sim.similar_name_pairs * 15, 30)
    }

    // Factor 4: phone duplicates
    const uniquePhones = new Set(stat.phone_numbers.filter(Boolean))
    if (uniquePhones.size < stat.phone_numbers.filter(Boolean).length) score += 15

    const risk_score = Math.min(score, 100)
    const risk_level: 'High' | 'Medium' | 'Low' =
      risk_score >= 60 ? 'High' : risk_score >= 30 ? 'Medium' : 'Low'

    return { ...stat, risk_score, risk_level }
  })
}

export function getClusterDetails(rows: Row[], clusterId: number): Row[] {
  const clusterRows = rows.filter(r => r.cluster_id === clusterId)
  // Latest meeting per buyerid+traderId pair
  const latest: Record<string, Row> = {}
  for (const r of clusterRows) {
    const key = `${r.buyerid}::${r.traderId}`
    if (!latest[key] || r.meetingDate > latest[key].meetingDate) {
      latest[key] = r
    }
  }
  return Object.values(latest)
}

export function getRetailerAllMeetings(rows: Row[], buyerid: string, traderId: string): Row[] {
  return rows
    .filter(r => r.buyerid === buyerid && r.traderId === traderId)
    .sort((a, b) => (a.meetingDate > b.meetingDate ? -1 : 1))
}
