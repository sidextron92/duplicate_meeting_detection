'use client'

import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { validateCSV, cleanAndProcessData } from '@/lib/dataProcessing'
import type { Row } from '@/lib/types'

interface Props {
  onDataLoaded: (rows: Row[]) => void
}

const SQL_QUERY = `SELECT
    DATE_FORMAT(fm.created_at,'%Y-%m-%d') as meetingDate,
    lpa.uniqueId as dsid,
    lpa.city as Darkstore,
    fu.name as traderName,
    fu.fosId as traderId,
    um.companyName as buyerName,
    um.userID as buyerid,
    um.companyPhone buyerPhone,
    fm.created_at as meetingTime,
    fm.remarks,
    fm.currentLatitude,
    fm.currentLongitude,
    GROUP_CONCAT(DISTINCT o.skOrderID) as todayOrders,
    JSON_UNQUOTE(JSON_EXTRACT(fm.metaData,'$.images')) as selfie,
    round(fm.distance,0) as distancemtr,
    um.created_at as buyerRegistrationDate,
    um.orderVerifyDoc as verificationDoc
FROM fos_meetings fm
LEFT JOIN orders o
    ON o.userID = fm.buyerId
    AND date_format(o.created_at,'%Y-%m-%d') = date_format(fm.created_at,'%Y-%m-%d')
    AND DATE_FORMAT(o.created_at,'%Y%m')=202512
INNER JOIN user_master um ON um.userID = fm.buyerId
INNER JOIN fos_users fu ON fu.fosId=fm.fosId
INNER JOIN lp_address lpa ON lpa.uniqueId = fu.dsId
WHERE DATE_FORMAT(fm.created_at,'%Y%m')=202512
GROUP BY fm.buyerid, DATE_FORMAT(fm.created_at,'%Y%m%d')
ORDER BY meetingDate;`

export default function FileUpload({ onDataLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleFile(file: File) {
    setLoading(true)
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const raw = result.data as Record<string, string>[]
        const { valid, error: err } = validateCSV(raw)
        if (!valid) {
          setError(err ?? 'Invalid CSV')
          setLoading(false)
          return
        }
        const rows = cleanAndProcessData(raw)
        setLoading(false)
        onDataLoaded(rows)
      },
      error: (err) => {
        setError(err.message)
        setLoading(false)
      },
    })
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleCopy() {
    navigator.clipboard.writeText(SQL_QUERY).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">Fraud Detection Dashboard</h1>
        <p className="text-zinc-400 mt-2">Upload your meetings CSV to begin analysis</p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
          ${dragging ? 'border-blue-500 bg-blue-950/20' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'}`}
      >
        <div className="text-4xl mb-4">📂</div>
        <p className="text-zinc-200 font-medium">Drop CSV file here or click to browse</p>
        <p className="text-zinc-500 text-sm mt-1">Requires meetingDate, buyerid, GPS coordinates, and more</p>
        {loading && <p className="text-blue-400 mt-4 text-sm">Processing...</p>}
        {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {/* SQL Query Reference */}
      <div className="w-full max-w-2xl mt-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-zinc-400 text-sm font-semibold">SQL Query to generate CSV</p>
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-zinc-300 text-xs overflow-x-auto whitespace-pre font-mono leading-relaxed">
          {SQL_QUERY}
        </pre>
      </div>
    </div>
  )
}
