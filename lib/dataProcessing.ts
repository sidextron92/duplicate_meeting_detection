import type { Row, Filters, FilterOptions } from './types'

const REQUIRED_COLUMNS = [
  'meetingDate', 'Darkstore', 'traderName', 'traderId',
  'buyerName', 'buyerid', 'buyerPhone',
  'currentLatitude', 'currentLongitude',
  'selfie', 'verificationDoc',
]

export function validateCSV(rows: Record<string, string>[]): { valid: boolean; error?: string } {
  if (rows.length === 0) return { valid: false, error: 'CSV file is empty' }
  const cols = Object.keys(rows[0])
  const missing = REQUIRED_COLUMNS.filter(c => !cols.includes(c))
  if (missing.length > 0) return { valid: false, error: `Missing required columns: ${missing.join(', ')}` }
  return { valid: true }
}

export function cleanAndProcessData(raw: Record<string, string>[]): Row[] {
  const rows: Row[] = []

  for (const r of raw) {
    const lat = parseFloat(r.currentLatitude)
    const lon = parseFloat(r.currentLongitude)

    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lon)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue

    const selfie = (r.selfie ?? '').replace(/[\[\]'"]/g, '').trim()
    const verificationDoc = (r.verificationDoc ?? '').replace(/[\[\]'"]/g, '').trim()
    const phone = (r.buyerPhone ?? '').replace(/\D/g, '')

    rows.push({
      meetingDate: r.meetingDate ?? '',
      meetingTime: r.meetingTime,
      Darkstore: (r.Darkstore ?? '').trim(),
      traderName: (r.traderName ?? '').trim(),
      traderId: r.traderId ?? '',
      buyerName: (r.buyerName ?? '').trim(),
      buyerid: r.buyerid ?? '',
      buyerPhone: phone,
      buyerRegistrationDate: r.buyerRegistrationDate,
      currentLatitude: lat,
      currentLongitude: lon,
      selfie,
      verificationDoc,
      remarks: r.remarks,
      distancemtr: r.distancemtr,
      todayOrders: r.todayOrders,
      has_valid_gps: true,
      has_selfie: selfie.length > 0,
      has_verification: verificationDoc.length > 0,
    })
  }

  return rows
}

export function getFilterOptions(rows: Row[]): FilterOptions {
  const darkstores = [...new Set(rows.map(r => r.Darkstore))].filter(Boolean).sort()
  const traders = [...new Set(rows.map(r => r.traderName))].filter(Boolean).sort()
  const dates = rows.map(r => r.meetingDate).filter(Boolean).sort()
  return {
    darkstores,
    traders,
    dateRange: [dates[0] ?? '', dates[dates.length - 1] ?? ''],
  }
}

export function applyFilters(rows: Row[], filters: Filters): Row[] {
  let filtered = rows

  if (filters.darkstores.length > 0) {
    filtered = filtered.filter(r => filters.darkstores.includes(r.Darkstore))
  }

  if (filters.traders.length > 0) {
    filtered = filtered.filter(r => filters.traders.includes(r.traderName))
  }

  if (filters.dateRange) {
    const [start, end] = filters.dateRange
    filtered = filtered.filter(r => r.meetingDate >= start && r.meetingDate <= end)
  }

  if (filters.lastMeetingAfter) {
    // Find last meeting date per buyerid+traderId pair
    const lastMeeting: Record<string, string> = {}
    for (const r of filtered) {
      const key = `${r.buyerid}::${r.traderId}`
      if (!lastMeeting[key] || r.meetingDate > lastMeeting[key]) {
        lastMeeting[key] = r.meetingDate
      }
    }
    const pairsToKeep = new Set(
      Object.entries(lastMeeting)
        .filter(([, date]) => date >= filters.lastMeetingAfter!)
        .map(([key]) => key)
    )
    filtered = filtered.filter(r => pairsToKeep.has(`${r.buyerid}::${r.traderId}`))
  }

  return filtered
}
