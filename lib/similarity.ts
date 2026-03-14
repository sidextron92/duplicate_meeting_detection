import { distance } from 'fastest-levenshtein'
import type { Row, ClusterSimilarity, SimilarityMap } from './types'

function tokenSortRatio(a: string, b: string): number {
  const sortedA = a.toLowerCase().trim().split(/\s+/).sort().join(' ')
  const sortedB = b.toLowerCase().trim().split(/\s+/).sort().join(' ')
  const maxLen = Math.max(sortedA.length, sortedB.length)
  if (maxLen === 0) return 100
  const dist = distance(sortedA, sortedB)
  return Math.round((1 - dist / maxLen) * 100)
}

export function analyzeClusterSimilarity(
  rows: Row[],
  clusterId: number,
  threshold = 90
): ClusterSimilarity {
  const clusterRows = rows.filter(r => r.cluster_id === clusterId)

  // Latest meeting per buyerid
  const latest: Record<string, Row> = {}
  for (const r of clusterRows) {
    if (!latest[r.buyerid] || r.meetingDate > latest[r.buyerid].meetingDate) {
      latest[r.buyerid] = r
    }
  }
  const unique = Object.values(latest)

  const empty: ClusterSimilarity = {
    cluster_id: clusterId,
    similar_name_pairs: 0,
    phone_duplicates: 0,
    name_pairs: [],
    phone_groups: [],
    max_similarity: 0,
  }

  if (unique.length < 2) return empty

  // Name similarity pairs
  const name_pairs: ClusterSimilarity['name_pairs'] = []
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const sim = tokenSortRatio(unique[i].buyerName, unique[j].buyerName)
      if (sim >= threshold) {
        name_pairs.push({
          retailer1: unique[i].buyerName,
          retailer2: unique[j].buyerName,
          id1: unique[i].buyerid,
          id2: unique[j].buyerid,
          similarity: sim,
        })
      }
    }
  }

  // Phone duplicates
  const phoneMap: Record<string, { names: string[]; ids: string[] }> = {}
  for (const r of unique) {
    if (!r.buyerPhone) continue
    if (!phoneMap[r.buyerPhone]) phoneMap[r.buyerPhone] = { names: [], ids: [] }
    phoneMap[r.buyerPhone].names.push(r.buyerName)
    phoneMap[r.buyerPhone].ids.push(r.buyerid)
  }
  const phone_groups = Object.entries(phoneMap)
    .filter(([, v]) => v.names.length > 1)
    .map(([phone, v]) => ({
      phone,
      retailers: v.names,
      ids: v.ids,
      count: v.names.length,
    }))

  return {
    cluster_id: clusterId,
    similar_name_pairs: name_pairs.length,
    phone_duplicates: phone_groups.length,
    name_pairs,
    phone_groups,
    max_similarity: name_pairs.length > 0 ? Math.max(...name_pairs.map(p => p.similarity)) : 0,
  }
}

export function analyzeAllClusters(rows: Row[], threshold = 90): SimilarityMap {
  const clusterIds = [...new Set(rows.filter(r => (r.cluster_id ?? -1) >= 0).map(r => r.cluster_id!))]
  const results: SimilarityMap = {}
  for (const cid of clusterIds) {
    results[`cluster_${cid}`] = analyzeClusterSimilarity(rows, cid, threshold)
  }
  return results
}
