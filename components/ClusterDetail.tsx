'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { getClusterDetails, getRetailerAllMeetings } from '@/lib/clustering'
import type { Row, ClusterStat, SimilarityMap, DuplicateEntry } from '@/lib/types'

interface Props {
  clusterId: number
  clusterStat: ClusterStat
  allRows: Row[]
  similarityResults: SimilarityMap
  onClose: () => void
  // buyerids already marked in this cluster (across all groups)
  markedBuyerIds: Set<string>
  onMarkDuplicates: (entries: DuplicateEntry[]) => void
}

function fmtDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = iso.slice(0, 10) // YYYY-MM-DD
  return `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`
}

const RISK_BADGE: Record<string, string> = {
  High: 'bg-red-900/50 text-red-400 border-red-800',
  Medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  Low: 'bg-green-900/50 text-green-400 border-green-800',
}

// Full-screen image viewer
function ImageViewer({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <span className="text-zinc-400 text-sm">{label}</span>
        <button className="text-white text-3xl leading-none hover:text-zinc-300">×</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// Square image placeholder — no crop, click opens viewer
function ImageBox({
  src,
  label,
  onViewImage,
}: {
  src: string | undefined
  label: string
  onViewImage: (src: string, label: string) => void
}) {
  return (
    <div className="relative w-full">
      <div
        className="aspect-square w-full bg-zinc-900 flex items-center justify-center overflow-hidden rounded-lg cursor-pointer group"
        onClick={() => src && onViewImage(src, label)}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            className="w-full h-full object-contain group-hover:brightness-90 transition-all"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className="text-zinc-600 text-xs">No {label.toLowerCase()}</span>
        )}
      </div>
      <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
        {label}
      </span>
    </div>
  )
}

interface MeetingModalProps {
  retailer: Row
  meetings: Row[]
  onClose: () => void
  onViewImage: (src: string, label: string) => void
  imageViewerOpen: boolean
}

function MeetingModal({ retailer, meetings, onClose, onViewImage, imageViewerOpen }: MeetingModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !imageViewerOpen) { e.stopImmediatePropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, imageViewerOpen])

  return (
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
          <div>
            <p className="text-white font-semibold">{retailer.buyerName}</p>
            <p className="text-zinc-400 text-xs">ID: {retailer.buyerid} · {meetings.length} meetings</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Meeting cards — horizontal scroll */}
        <div className="overflow-x-auto flex-1 p-4">
          <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
            {meetings.map((m, i) => (
              <div key={i} className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden flex flex-col w-56 shrink-0">
                {/* Selfie — square, no crop */}
                <ImageBox src={m.selfie} label="Selfie" onViewImage={onViewImage} />

                {/* Meta */}
                <div className="px-3 py-2 space-y-0.5">
                  <p className="text-zinc-200 font-semibold text-xs">📅 {fmtDate(m.meetingDate)}</p>
                  {m.meetingTime && (
                    <p className="text-zinc-400 text-xs">
                      🕐 {new Date(m.meetingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <p className="text-zinc-400 text-xs">👤 {m.traderName}</p>
                  {m.distancemtr && <p className="text-zinc-400 text-xs">📍 {m.distancemtr}m away</p>}
                  {m.remarks && <p className="text-zinc-500 text-xs italic truncate">"{m.remarks}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ClusterDetail({
  clusterId,
  clusterStat,
  allRows,
  similarityResults,
  onClose,
  markedBuyerIds,
  onMarkDuplicates,
}: Props) {
  const [modalRetailer, setModalRetailer] = useState<Row | null>(null)
  const [viewerSrc, setViewerSrc] = useState<{ src: string; label: string } | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  const details = getClusterDetails(allRows, clusterId)
  const sim = similarityResults[`cluster_${clusterId}`]
  const modalMeetings = modalRetailer ? getRetailerAllMeetings(allRows, modalRetailer.buyerid, modalRetailer.traderId) : []

  // Reset checkboxes when cluster changes
  useEffect(() => { setCheckedIds(new Set()) }, [clusterId])

  function openImage(src: string, label: string) {
    setViewerSrc({ src, label })
  }

  function toggleCheck(key: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleMarkDuplicates() {
    if (checkedIds.size < 2) return
    const sortedIds = [...checkedIds].sort()
    const duplicate_id = sortedIds.join('|')
    const entries: DuplicateEntry[] = details
      .filter(r => checkedIds.has(`${r.buyerid}::${r.traderId}`))
      .map(r => ({
        duplicate_id,
        cluster_id: clusterId,
        buyerid: r.buyerid,
        buyerName: r.buyerName,
        buyerPhone: r.buyerPhone,
        traderName: r.traderName,
        Darkstore: r.Darkstore,
        meetingDate: r.meetingDate,
      }))
    onMarkDuplicates(entries)
    setCheckedIds(new Set())
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-semibold">Cluster #{clusterId}</h2>
            <Badge className={`text-xs border ${RISK_BADGE[clusterStat.risk_level]}`}>
              {clusterStat.risk_level} — {clusterStat.risk_score}
            </Badge>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Retailer Cards — horizontal scroll */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">
                Retailers ({details.length})
              </h3>
              {checkedIds.size >= 2 && (
                <button
                  onClick={handleMarkDuplicates}
                  className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded transition-colors font-medium"
                >
                  Mark Duplicates ({checkedIds.size})
                </button>
              )}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {details.map(r => {
                const pairKey = `${r.buyerid}::${r.traderId}`
                const isMarked = markedBuyerIds.has(r.buyerid)
                const isChecked = checkedIds.has(pairKey)
                const isDisabled = isMarked && !isChecked

                return (
                  <div
                    key={`${r.buyerid}::${r.traderId}`}
                    className={`rounded-xl border overflow-hidden flex-none w-52 transition-all ${
                      isMarked
                        ? 'border-orange-600/70 bg-orange-950/30'
                        : isChecked
                        ? 'border-blue-500 bg-blue-950/30'
                        : 'border-zinc-700 bg-zinc-800/60'
                    }`}
                  >
                    {/* Checkbox row */}
                    <label
                      className={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer ${
                        isMarked ? 'border-orange-800/50' : 'border-zinc-700'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => !isDisabled && toggleCheck(pairKey)}
                        className="accent-blue-500 w-3.5 h-3.5"
                      />
                      {isMarked ? (
                        <span className="text-orange-400 text-[10px] font-semibold uppercase tracking-wide">Already marked</span>
                      ) : (
                        <span className="text-zinc-500 text-[10px]">Select as duplicate</span>
                      )}
                    </label>

                    {/* Selfie — square, no crop, click to view full image */}
                    <ImageBox src={r.selfie} label="Selfie" onViewImage={openImage} />

                    {/* Retailer info */}
                    <div className="px-3 py-2 space-y-0.5 border-b border-zinc-700">
                      <p className="text-zinc-100 font-semibold text-sm truncate">{r.buyerName}</p>
                      <p className="text-zinc-400 text-xs">ID: {r.buyerid}</p>
                      <p className="text-zinc-400 text-xs">📞 {r.buyerPhone || '—'}</p>
                      <p className="text-zinc-400 text-xs">👤 {r.traderName}</p>
                      <p className="text-zinc-400 text-xs">📅 {fmtDate(r.meetingDate)} · {r.meeting_count} meeting{r.meeting_count !== 1 ? 's' : ''}</p>
                      {r.buyerRegistrationDate && (
                        <p className="text-zinc-400 text-xs">🗓 Registered: {fmtDate(r.buyerRegistrationDate)}</p>
                      )}

                      {/* CTA to open Other Meetings modal */}
                      <button
                        onClick={() => setModalRetailer(r)}
                        className="mt-1.5 w-full text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded py-1 transition-colors"
                      >
                        View all meetings →
                      </button>
                    </div>

                    {/* Verification doc — square, no crop, click to view full image */}
                    <ImageBox src={r.verificationDoc} label="Doc" onViewImage={openImage} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Similar Names */}
          {sim && sim.name_pairs.length > 0 && (
            <div>
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">
                Similar Names ({sim.name_pairs.length})
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-1 px-2">Retailer 1</th>
                    <th className="text-left py-1 px-2">Retailer 2</th>
                    <th className="text-right py-1 px-2">Similarity</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.name_pairs.map((p, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 text-zinc-300">
                      <td className="py-1 px-2">{p.retailer1}</td>
                      <td className="py-1 px-2">{p.retailer2}</td>
                      <td className="py-1 px-2 text-right font-mono text-yellow-400">{p.similarity}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Phone Duplicates */}
          {sim && sim.phone_groups.length > 0 && (
            <div>
              <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-2">
                Phone Duplicates ({sim.phone_groups.length})
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-1 px-2">Phone</th>
                    <th className="text-left py-1 px-2">Retailers</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.phone_groups.map((g, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 text-zinc-300">
                      <td className="py-1 px-2 font-mono text-red-400">{g.phone}</td>
                      <td className="py-1 px-2">{g.retailers.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Other Meetings Modal */}
      {modalRetailer && (
        <MeetingModal
          retailer={modalRetailer}
          meetings={modalMeetings}
          onClose={() => setModalRetailer(null)}
          onViewImage={openImage}
          imageViewerOpen={viewerSrc !== null}
        />
      )}

      {/* Full-screen image viewer — highest z-index */}
      {viewerSrc && (
        <ImageViewer
          src={viewerSrc.src}
          label={viewerSrc.label}
          onClose={() => setViewerSrc(null)}
        />
      )}
    </>
  )
}
