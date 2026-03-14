'use client'

import { useEffect, useRef } from 'react'
import type { ClusterStat } from '@/lib/types'

interface Props {
  clusterStats: ClusterStat[]
  selectedClusterId: number | null
  onClusterSelect: (id: number) => void
}

const RISK_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#eab308',
  Low: '#22c55e',
}

export default function ClusterMap({ clusterStats, selectedClusterId, onClusterSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  const latestStatsRef = useRef<ClusterStat[]>(clusterStats)
  const latestSelectedRef = useRef<number | null>(selectedClusterId)
  const onClusterSelectRef = useRef(onClusterSelect)
  // Track whether markers have been drawn at least once (for fitBounds only on first load)
  const hasFitBoundsRef = useRef(false)

  latestStatsRef.current = clusterStats
  latestSelectedRef.current = selectedClusterId
  onClusterSelectRef.current = onClusterSelect

  function drawMarkers(map: unknown, L: unknown, isInitialDraw = false) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { map: m, L: Leaflet } = { map, L } as { map: any, L: any }
    const stats = latestStatsRef.current
    const selected = latestSelectedRef.current

    markersRef.current.forEach(mk => mk.remove())
    markersRef.current = []

    if (stats.length === 0) return

    const bounds: [number, number][] = []

    stats.forEach(stat => {
      const color = RISK_COLORS[stat.risk_level]
      const isSelected = stat.cluster_id === selected

      const circle = Leaflet.circleMarker([stat.center_lat, stat.center_lon], {
        radius: isSelected ? 16 : 10,
        fillColor: color,
        color: isSelected ? '#222' : color,
        weight: isSelected ? 2.5 : 1,
        opacity: 1,
        fillOpacity: isSelected ? 0.75 : 0.6,
      })

      circle.bindPopup(`
        <div style="font-family:monospace;min-width:160px">
          <strong style="color:${color}">Cluster #${stat.cluster_id}</strong><br/>
          Risk: <strong>${stat.risk_level}</strong> (${stat.risk_score})<br/>
          Retailers: ${stat.retailer_count}<br/>
          Traders: ${stat.trader_count}
        </div>
      `)

      circle.on('click', () => onClusterSelectRef.current(stat.cluster_id))
      circle.addTo(m)
      markersRef.current.push(circle)
      bounds.push([stat.center_lat, stat.center_lon])
    })

    // Only fitBounds on the very first draw — preserve zoom on selection changes
    if (isInitialDraw && !hasFitBoundsRef.current && bounds.length > 0) {
      m.fitBounds(Leaflet.latLngBounds(bounds), { padding: [40, 40] })
      hasFitBoundsRef.current = true
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((mapRef.current as any)._leaflet_id) return

    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || !mapRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mapRef.current as any)._leaflet_id) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current, {
        center: [20, 78],
        zoom: 5,
        preferCanvas: true,
      })

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = { map, L }

      if (latestStatsRef.current.length > 0) {
        drawMarkers(map, L, true)
      }
    })

    return () => {
      cancelled = true
      hasFitBoundsRef.current = false
      if (mapInstanceRef.current?.map) {
        mapInstanceRef.current.map.remove()
        mapInstanceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw markers when stats change (new analysis) — fitBounds; on selection change — no fitBounds
  const prevStatsLenRef = useRef(0)
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const { map, L } = mapInstanceRef.current
    const statsChanged = clusterStats.length !== prevStatsLenRef.current
    if (statsChanged) {
      hasFitBoundsRef.current = false
      prevStatsLenRef.current = clusterStats.length
    }
    drawMarkers(map, L, statsChanged)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterStats, selectedClusterId])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className="w-full h-full rounded-lg" />
    </>
  )
}
