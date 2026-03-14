export interface Row {
  meetingDate: string
  meetingTime?: string
  Darkstore: string
  traderName: string
  traderId: string
  buyerName: string
  buyerid: string
  buyerPhone: string
  buyerRegistrationDate?: string
  currentLatitude: number
  currentLongitude: number
  selfie: string
  verificationDoc: string
  remarks?: string
  distancemtr?: string
  todayOrders?: string
  // computed
  has_valid_gps?: boolean
  has_selfie?: boolean
  has_verification?: boolean
  cluster_id?: number
  meeting_count?: number
}

export interface Filters {
  darkstores: string[]
  traders: string[]
  dateRange: [string, string] | null
  lastMeetingAfter: string | null
}

export interface FilterOptions {
  darkstores: string[]
  traders: string[]
  dateRange: [string, string]
}

export interface ClusterStat {
  cluster_id: number
  retailer_count: number
  trader_count: number
  retailer_names: string[]
  phone_numbers: string[]
  center_lat: number
  center_lon: number
  risk_score: number
  risk_level: 'High' | 'Medium' | 'Low'
}

export interface NamePair {
  retailer1: string
  retailer2: string
  id1: string
  id2: string
  similarity: number
}

export interface PhoneGroup {
  phone: string
  retailers: string[]
  ids: string[]
  count: number
}

export interface ClusterSimilarity {
  cluster_id: number
  similar_name_pairs: number
  phone_duplicates: number
  name_pairs: NamePair[]
  phone_groups: PhoneGroup[]
  max_similarity: number
}

export type SimilarityMap = Record<string, ClusterSimilarity>

export interface AppConfig {
  radiusMeters: number
  minSamples: number
}

export interface DuplicateEntry {
  duplicate_id: string   // sorted buyerids joined by '|'
  cluster_id: number
  buyerid: string
  buyerName: string
  buyerPhone: string
  traderName: string
  Darkstore: string
  meetingDate: string
}
