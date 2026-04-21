import { create } from 'zustand'
import axios from 'axios'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Series, CollectionEntry, CollectionEntryWithSeries, GoogleBooksVolume } from '../types'

const JIKAN_BASE = 'https://api.jikan.moe/v4'
const JIKAN_DELAY_MS = 450  // Jikan rate-limit: ~3 req/s
const API_DELAY_MS = 200

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Title cleaning ────────────────────────────────────────────────────────────
// Strips volume/edition suffixes to get the bare series name for AniList/Jikan.
// "Attack on Titan Vol. 2" → "Attack on Titan"
// "Demon Slayer: Kimetsu no Yaiba, Vol. 1" → "Demon Slayer: Kimetsu no Yaiba"
function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\s*[,:–-]\s*(vol(ume)?|season|part|omnibus|deluxe|box\s*set)\b.*/i, '')
    .replace(/\s+vol(ume)?\s*\.?\s*\d+.*/i, '')
    .replace(/\s+#\d+.*/i, '')
    .replace(/\s+\d{1,3}\s*$/, '')   // bare trailing number  e.g. "Naruto 10"
    .replace(/\s+\(\d{4}\)$/, '')    // trailing year
    .trim()
}

// ─── Title similarity ──────────────────────────────────────────────────────────
// Jaccard word-overlap. Returns 0–1. Used to validate that an API result actually
// matches what we searched for (rejects spin-offs, wrong series, etc.)
const SIMILARITY_THRESHOLD = 0.35

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(the|a|an|and|of|in|on|to)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleSimilarity(search: string, result: string): number {
  const a = normTitle(cleanTitleForSearch(search))
  const b = normTitle(result)
  if (!a || !b) return 0
  if (a === b) return 1
  if (b.includes(a) || a.includes(b)) return 0.85
  const wa = new Set(a.split(' ').filter(Boolean))
  const wb = new Set(b.split(' ').filter(Boolean))
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return union === 0 ? 0 : intersection / union
}

// ─── URL safety ────────────────────────────────────────────────────────────────
const KNOWN_IMAGE_HOSTS = [
  'anilist.co',
  's4.anilist.co',
  'myanimelist.net',
  'cdn.myanimelist.net',
  'books.google.com',
  'googleapis.com',
  'covers.openlibrary.org',  // Open Library volume covers (ISBN-based)
  'media.kitsu.app',
  'image.tmdb.org',
]

function isValidCoverUrl(url: string | null): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return KNOWN_IMAGE_HOSTS.some(h => u.hostname.endsWith(h))
  } catch {
    return false
  }
}

function sanitizeCoverUrl(url: string): string {
  return url
    .replace('http://', 'https://')
    .replace('zoom=1', 'zoom=3')
    .replace('&edge=curl', '')
}

// ─── Open Library — ISBN cover lookup ─────────────────────────────────────────
// Free, no API key required. Returns per-volume covers when an ISBN is stored
// (e.g. from barcode scanning). This is the ONLY reliable way to get a cover
// that is specific to a particular volume rather than the whole series.
async function fetchOpenLibraryCoverByISBN(isbn: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    )
    if (!res.ok) return null
    const data = await res.json()
    const book = data[`ISBN:${isbn}`]
    if (!book) return null
    const raw: string | undefined =
      book.cover?.large || book.cover?.medium || book.cover?.small
    if (!raw) return null
    const url = raw.startsWith('http://') ? raw.replace('http://', 'https://') : raw
    return isValidCoverUrl(url) ? url : null
  } catch {
    return null
  }
}

// ─── AniList ───────────────────────────────────────────────────────────────────
// Best source for manga series covers. Searched by cleaned series name so volume
// numbers in the title are stripped before the query.
interface AniListResult {
  cover: string | null
  matchedTitle: string
  meta: Partial<Series>
}

async function fetchAniListCover(title: string): Promise<AniListResult | null> {
  const cleanTitle = cleanTitleForSearch(title)
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($search: String) {
          Media(search: $search, type: MANGA) {
            title { romaji english native }
            coverImage { extraLarge large }
            volumes status genres
            description(asHtml: false)
          }
        }`,
        variables: { search: cleanTitle },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const m = data?.data?.Media
    if (!m) return null

    const matchedTitle = m.title?.english || m.title?.romaji || m.title?.native || ''
    const sim = titleSimilarity(title, matchedTitle)
    if (sim < SIMILARITY_THRESHOLD) return null

    const coverRaw = m.coverImage?.extraLarge || m.coverImage?.large || null
    const cover = coverRaw && isValidCoverUrl(coverRaw) ? coverRaw : null

    return {
      cover,
      matchedTitle,
      meta: {
        description: m.description?.replace(/<[^>]+>/g, '') ?? undefined,
        total_volumes: m.volumes ?? undefined,
        status:
          m.status === 'FINISHED' ? 'Complete'
          : m.status === 'RELEASING' ? 'Ongoing'
          : undefined,
        genre: m.genres?.length ? m.genres : undefined,
      },
    }
  } catch {
    return null
  }
}

// ─── Jikan (MAL) ──────────────────────────────────────────────────────────────
interface JikanResult {
  cover: string | null
  matchedTitle: string
  meta: Partial<Series>
}

async function fetchJikanCover(title: string): Promise<JikanResult | null> {
  const cleanTitle = cleanTitleForSearch(title)
  try {
    await sleep(JIKAN_DELAY_MS)
    const jRes = await axios.get(`${JIKAN_BASE}/manga`, {
      params: { q: cleanTitle, limit: 5 },
      timeout: 8000,
    })
    const results: any[] = jRes.data?.data || []
    if (!results.length) return null

    let best: any = null
    let bestSim = 0
    for (const r of results) {
      const candidate = r.title_english || r.title || ''
      const sim = titleSimilarity(title, candidate)
      if (sim > bestSim) { bestSim = sim; best = r }
    }

    if (!best || bestSim < SIMILARITY_THRESHOLD) return null

    const coverRaw =
      best.images?.jpg?.large_image_url ||
      best.images?.jpg?.image_url ||
      best.images?.webp?.large_image_url ||
      null
    const cover = coverRaw && isValidCoverUrl(coverRaw) ? coverRaw : null

    return {
      cover,
      matchedTitle: best.title_english || best.title || '',
      meta: {
        description: best.synopsis ?? undefined,
        total_volumes: best.volumes ?? undefined,
        status:
          best.status === 'Finished' ? 'Complete'
          : best.status === 'Publishing' ? 'Ongoing'
          : undefined,
        genre: best.genres?.length ? best.genres.map((g: any) => g.name) : undefined,
        demographic: best.demographics?.[0]?.name?.toLowerCase() ?? undefined,
        mal_id: best.mal_id ?? undefined,
      },
    }
  } catch {
    return null
  }
}

// ─── Store interface ───────────────────────────────────────────────────────────
interface EnrichProgress {
  total: number
  done: number
  current: string
  active: boolean
  fixed: number
}

interface CollectionState {
  entries: CollectionEntryWithSeries[]
  loading: boolean
  error: string | null
  enrichProgress: EnrichProgress | null

  fetchCollection: () => Promise<void>
  addSeries: (
    series: Omit<Series, 'id' | 'created_at' | 'updated_at'>,
    entry: Omit<CollectionEntry, 'id' | 'series_id' | 'series'>
  ) => Promise<void>
  updateEntry: (id: string, updates: Partial<CollectionEntry>) => Promise<void>
  updateSeries: (id: string, updates: Partial<Series>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  importEntries: (
    data: Array<{
      series: Omit<Series, 'id' | 'created_at' | 'updated_at'>
      entry: Omit<CollectionEntry, 'id' | 'series_id' | 'series'>
    }>
  ) => Promise<{ imported: number; skipped: number }>
  enrichCovers: (options?: { forceRefetch?: boolean }) => Promise<void>
  cancelEnrich: () => void
  lookupByISBN: (isbn: string) => Promise<GoogleBooksVolume | null>
}

let enrichCancelled = false

export const useCollectionStore = create<CollectionState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,
  enrichProgress: null,

  // ─── Read ──────────────────────────────────────────────────────────────────
  fetchCollection: async () => {
    if (!isSupabaseConfigured) { set({ loading: false }); return }
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('collection_entries')
        .select(`*, series (*)`)
        .order('date_added', { ascending: false })
      if (error) throw error
      set({ entries: (data as CollectionEntryWithSeries[]) || [], loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  // ─── Write ─────────────────────────────────────────────────────────────────
  addSeries: async (seriesData, entryData) => {
    try {
      const { data: existing } = await supabase
        .from('series')
        .select('id')
        .ilike('title', seriesData.title)
        .single()

      let seriesId: string
      if (existing) {
        seriesId = existing.id
      } else {
        const { data: newSeries, error: seriesError } = await supabase
          .from('series')
          .insert(seriesData)
          .select()
          .single()
        if (seriesError) throw seriesError
        seriesId = newSeries.id
      }

      const { error: entryError } = await supabase
        .from('collection_entries')
        .insert({ ...entryData, series_id: seriesId })
      if (entryError) throw entryError
      await get().fetchCollection()
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  updateEntry: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('collection_entries')
        .update(updates)
        .eq('id', id)
      if (error) throw error
      set(state => ({
        entries: state.entries.map(e => e.id === id ? { ...e, ...updates } : e),
      }))
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  updateSeries: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('series')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      set(state => ({
        entries: state.entries.map(e =>
          e.series_id === id ? { ...e, series: { ...e.series, ...updates } } : e
        ),
      }))
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  deleteEntry: async (id) => {
    try {
      const { error } = await supabase
        .from('collection_entries')
        .delete()
        .eq('id', id)
      if (error) throw error
      set(state => ({ entries: state.entries.filter(e => e.id !== id) }))
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },

  importEntries: async (data) => {
    let imported = 0
    let skipped = 0
    for (const { series: seriesData, entry: entryData } of data) {
      try {
        if (!seriesData.title?.trim()) { skipped++; continue }
        await get().addSeries(seriesData, entryData)
        imported++
      } catch {
        skipped++
      }
    }
    return { imported, skipped }
  },

  cancelEnrich: () => {
    enrichCancelled = true
    set({ enrichProgress: null })
  },

  // ─── ISBN lookup (barcode scanner) ────────────────────────────────────────
  lookupByISBN: async (isbn) => {
    try {
      const key =
        localStorage.getItem('google_books_api_key') ||
        import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''
      const params: Record<string, string> = { q: `isbn:${isbn}`, maxResults: '1' }
      if (key) params.key = key
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams(params)}`
      )
      if (!res.ok) return null
      const data = await res.json()
      const item = data.items?.[0]
      if (!item) return null
      const info = item.volumeInfo
      const ids: Array<{ type: string; identifier: string }> = info.industryIdentifiers || []
      const isbnVal =
        ids.find(x => x.type === 'ISBN_13')?.identifier ||
        ids.find(x => x.type === 'ISBN_10')?.identifier ||
        isbn
      const links = info.imageLinks || {}
      const rawThumb =
        links.extraLarge || links.large || links.thumbnail || links.smallThumbnail || null
      const thumbnail = rawThumb ? sanitizeCoverUrl(rawThumb) : null
      return {
        isbn: isbnVal,
        title: info.title || '',
        authors: info.authors || [],
        publisher: info.publisher || null,
        publishedDate: info.publishedDate || null,
        description: info.description || null,
        thumbnail,
        pageCount: info.pageCount || null,
      }
    } catch {
      return null
    }
  },

  // ─── Cover enrichment ─────────────────────────────────────────────────────
  //
  // Priority order for every series:
  //
  //   1. Open Library by ISBN  — exact per-volume cover, free, no API key.
  //                              Only works when an ISBN is stored (barcode scan).
  //   2. AniList               — authoritative manga database, high-quality art.
  //                              Returns the series cover (same for all volumes of
  //                              a series). This is correct — it matches what MAL,
  //                              AniList, and Goodreads all display.
  //   3. Jikan / MAL           — fallback for titles AniList doesn't know.
  //
  // What we intentionally DO NOT do: Google Books text-search for volume covers.
  // That approach proved unreliable — the same popular book was returned for every
  // volume of a series because Google Books ranks by general relevance, not exact
  // title match. The only reliable ISBN-free cover source is a manga database,
  // and manga databases are series-level by design.
  //
  enrichCovers: async (options = {}) => {
    const { forceRefetch = false } = options
    enrichCancelled = false

    const targets = forceRefetch
      ? get().entries
      : get().entries.filter(e => !e.series.cover_image_url)

    // One DB row per series — de-duplicate so multi-entry series aren't fetched twice
    const seen = new Set<string>()
    const queue = targets.filter(e => {
      if (seen.has(e.series_id)) return false
      seen.add(e.series_id)
      return true
    })

    if (queue.length === 0) return

    set({
      enrichProgress: { total: queue.length, done: 0, current: '', active: true, fixed: 0 },
    })

    for (let i = 0; i < queue.length; i++) {
      if (enrichCancelled) break

      const entry = queue[i]
      const title = entry.series.title

      set(s => ({
        enrichProgress: s.enrichProgress
          ? { ...s.enrichProgress, done: i, current: title }
          : null,
      }))

      try {
        await sleep(API_DELAY_MS)

        let coverUrl: string | null = null
        let metaUpdates: Partial<Series> = {}

        // ── 1. Open Library by ISBN ─────────────────────────────────────────
        // Only available when an ISBN is stored (book was scanned with barcode
        // scanner). This gives a cover for the specific physical volume.
        if (entry.series.isbn) {
          coverUrl = await fetchOpenLibraryCoverByISBN(entry.series.isbn)
        }

        // ── 2. AniList ──────────────────────────────────────────────────────
        // Searches by cleaned series title (volume numbers stripped). Returns
        // the series cover art — the same image shown on every volume of a
        // series, which is the accepted standard across all manga platforms.
        if (!coverUrl) {
          const aliResult = await fetchAniListCover(title)
          if (aliResult) {
            coverUrl = aliResult.cover
            metaUpdates = aliResult.meta
          }
        }

        // ── 3. Jikan (MAL) fallback ─────────────────────────────────────────
        if (!coverUrl) {
          const jResult = await fetchJikanCover(title)
          if (jResult) {
            coverUrl = jResult.cover
            metaUpdates = { ...jResult.meta, ...metaUpdates }
          }
        }

        // ── Save ────────────────────────────────────────────────────────────
        const updates: Partial<Series> = { ...metaUpdates }

        if (coverUrl && isValidCoverUrl(coverUrl)) {
          updates.cover_image_url = coverUrl
        } else if (forceRefetch && !coverUrl) {
          updates.cover_image_url = null
        }

        if (Object.keys(updates).length > 0) {
          await get().updateSeries(entry.series_id, updates)
          set(s => ({
            enrichProgress: s.enrichProgress
              ? {
                  ...s.enrichProgress,
                  fixed: s.enrichProgress.fixed + (coverUrl ? 1 : 0),
                }
              : null,
          }))
        }
      } catch {
        // Skip this series — don't abort the whole run
      }
    }

    set({ enrichProgress: null })
    await get().fetchCollection()
  },
}))
