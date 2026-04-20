export type Demographic = 'shonen' | 'seinen' | 'shojo' | 'josei' | 'BL' | 'GL' | 'kodomomuke' | 'unknown'
export type ReadingStatus = 'Reading' | 'Completed' | 'Plan to Read' | 'Dropped' | 'On Hold'
export type SeriesStatus = 'Complete' | 'Ongoing' | 'Hiatus' | 'Discontinued' | 'Unknown'
export type Language = 'English' | 'Japanese' | 'Finnish' | 'Other'
export type Format = 'Single' | 'Omnibus' | 'Hardcover' | 'Boxset' | 'Digital'

export interface Series {
  id: string
  title: string
  author: string | null
  artist: string | null
  publisher: string | null
  original_publisher: string | null
  demographic: Demographic | null
  genre: string[]
  total_volumes: number | null
  total_pages: number | null
  status: SeriesStatus
  language: Language
  format: Format
  isbn: string | null
  upc: string | null
  msrp: number | null
  cover_image_url: string | null
  description: string | null
  mal_id: number | null
  created_at: string
  updated_at: string
}

export interface CollectionEntry {
  id: string
  series_id: string
  volumes_owned: number
  volumes_read: number
  reading_status: ReadingStatus
  rating: number | null
  notes: string | null
  date_added: string
  wishlist: boolean
  is_complete_in_collection: boolean
  series?: Series
}

export interface CollectionEntryWithSeries extends CollectionEntry {
  series: Series
}

// Jikan API types
export interface JikanManga {
  mal_id: number
  title: string
  title_english: string | null
  title_japanese: string | null
  images: {
    jpg: { image_url: string; large_image_url: string }
    webp: { image_url: string; large_image_url: string }
  }
  status: string
  volumes: number | null
  chapters: number | null
  synopsis: string | null
  authors: Array<{ name: string; type: string }>
  genres: Array<{ name: string }>
  demographics: Array<{ name: string }>
  serializations: Array<{ name: string }>
  published: { from: string; to: string }
  score: number | null
}

export interface JikanSearchResponse {
  data: JikanManga[]
  pagination: {
    last_visible_page: number
    has_next_page: boolean
  }
}

// ─── Google Books ────────────────────────────────────────────────────────────
export interface GoogleBooksVolume {
  isbn: string
  title: string
  authors: string[]
  publisher: string | null
  publishedDate: string | null
  description: string | null
  thumbnail: string | null
  pageCount: number | null
}

// ─── Release watchlist / notifications ───────────────────────────────────────
export interface WatchlistEntry {
  id: string
  series_id: string
  mu_series_id: number | null
  notify_inapp: boolean
  notify_push: boolean
  notify_email: boolean
  created_at: string
}

export interface AppNotification {
  id: string
  series_id: string
  volume_label: string
  release_date: string | null
  read_at: string | null
  buy_links: { amazon?: string; bn?: string; crunchyroll?: string }
  created_at: string
}

export interface DashboardStats {
  totalVolumes: number
  totalSeries: number
  completeSeries: number
  incompleteSeries: number
  oneshotSeries: number
  totalPagesRead: number
  readingStatusBreakdown: Record<ReadingStatus, number>
  demographicBreakdown: Record<string, number>
  topRated: CollectionEntryWithSeries[]
  recentlyAdded: CollectionEntryWithSeries[]
  currentlyReading: CollectionEntryWithSeries[]
  uniqueAuthors: number
  uniquePublishers: number
}
