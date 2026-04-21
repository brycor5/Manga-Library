import { create } from 'zustand'
import axios from 'axios'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Series, CollectionEntry, CollectionEntryWithSeries, GoogleBooksVolume } from '../types'

const JIKAN_BASE = 'https://api.jikan.moe/v4'
const JIKAN_DELAY_MS = 450  // Jikan allows ~3 req/s; stay safely under
const API_DELAY_MS = 200    // Polite delay between other API calls

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Title cleaning ───────────────────────────────────────────────────────────
// Strips volume/edition suffixes to get the bare series name for AniList/Jikan.
// e.g. "Attack on Titan Vol. 2" → "Attack on Titan"
function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\s*[,:–-]\s*(vol(ume)?|season|part|omnibus|deluxe|box\s*set)\b.*/i, '')
    .replace(/\s+vol(ume)?\s*\.?\s*\d+.*/i, '')
    .replace(/\s+#\d+.*/i, '')
    .replace(/\s+\(\d{4}\)$/, '')   // trailing year
    .trim()
}

// ─── Volume number detection ──────────────────────────────────────────────────
// Extracts the volume number from a title if present.
// "Attack on Titan Vol. 3" → 3
// "My Hero Academia #12"   → 12
// "Naruto"                 → null  (series-level, no volume)
function extractVolumeNumber(title: string): number | null {
  const match = title.match(
    /\b(?:vol(?:ume)?\.?\s*|#\s*)(\d+)\b/i
  )
  if (match) return parseInt(match[1], 10)
  // Bare trailing number: "One Piece 101" but NOT "Deadpool 2099" (too ambiguous)
  // Only treat it as a volume if the number is preceded by the series title with
  // no other context word between them.
  const bare = title.match(/\s+(\d{1,3})$/)
  if (bare) return parseInt(bare[1], 10)
  return null
}

// ─── Title similarity ─────────────────────────────────────────────────────────
// Jaccard word-overlap similarity after stripping punctuation and common articles.
// Returns 0–1. Threshold 0.35 means at least ~1/3 of significant words overlap.
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

// ─── URL safety ───────────────────────────────────────────────────────────────
// Reject obviously bad URLs before saving to the DB.
const KNOWN_IMAGE_HOSTS = [
  'anilist.co', 'myanimelist.net', 'cdn.myanimelist.net',
  'books.google.com', 'googleapis.com', 's4.anilist.co',
  'media.kitsu.app', 'image.tmdb.org',
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

// ─── AniList ──────────────────────────────────────────────────────────────────
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

    // Validate the match — take the best available title for comparison
    const matchedTitle =
      m.title?.english || m.title?.romaji || m.title?.native || ''
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

// ─── Jikan (MAL) ─────────────────────────────────────────────────────────────
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

    // Pick the best-matching result, not necessarily the first
    let best: any = null
    let bestSim = 0
    for (const r of results) {
      const candidate = r.title_english || r.title || ''
      const sim = titleSimilarity(title, candidate)
      if (sim > bestSim) {
        bestSim = sim
        best = r
      }
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
        genre: best.genres?.length
          ? best.genres.map((g: any) => g.name)
          : undefined,
        demographic:
          best.demographics?.[0]?.name?.toLowerCase() ?? undefined,
        mal_id: best.mal_id ?? undefined,
      },
    }
  } catch {
    return null
  }
}

// ─── Google Books ─────────────────────────────────────────────────────────────
// Generic series-level cover (used as last resort when no volume number).
async function fetchGoogleBooksCover(
  title: string,
  apiKey?: string
): Promise<{ cover: string | null; matchedTitle: string } | null> {
  const cleanTitle = cleanTitleForSearch(title)
  const key = apiKey || import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''
  const params: Record<string, string> = {
    q: `intitle:"${cleanTitle}" manga`,
    maxResults: '5',
    printType: 'books',
    // langRestrict intentionally omitted — we want all language editions
  }
  if (key) params.key = key

  try {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${qs}`)
    if (!res.ok) return null
    const data = await res.json()

    for (const item of data.items || []) {
      const info = item.volumeInfo
      const resultTitle = info?.title || ''
      const sim = titleSimilarity(title, resultTitle)
      if (sim < SIMILARITY_THRESHOLD) continue

      const links = info?.imageLinks
      const raw = links?.extraLarge || links?.large || links?.thumbnail || links?.smallThumbnail
      if (!raw) continue

      const cover = sanitizeCoverUrl(raw)
      if (!isValidCoverUrl(cover)) continue

      return { cover, matchedTitle: resultTitle }
    }
    return null
  } catch {
    return null
  }
}

// Returns true if a title is safe to use in English Google Books queries.
// AniList sometimes returns CJK / Cyrillic canonical titles that make
// queries useless — e.g. "NARUTO -ナルト-". We detect those and fall back.
function isLatinTitle(t: string): boolean {
  const nonLatin = (t.match(/[\u3000-\u9FFF\uAC00-\uD7AF\u0400-\u04FF]/g) || []).length
  return nonLatin / Math.max(t.length, 1) < 0.15
}

// Volume-specific cover — preferred when the title contains a volume number.
// canonicalTitle: the full series name from AniList (e.g. "Demon Slayer:
//   Kimetsu no Yaiba"). Used only when it's Latin/English — prevents CJK
//   canonical titles (e.g. "NARUTO -ナルト-") from polluting queries.
async function fetchVolumeSpecificCover(
  title: string,
  volNum: number,
  isbn: string | null,
  apiKey?: string,
  canonicalTitle?: string
): Promise<string | null> {
  const key = apiKey || import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''

  // ── 1. ISBN lookup — exact match, zero ambiguity ──────────────────────────
  if (isbn) {
    try {
      const params: Record<string, string> = { q: `isbn:${isbn}`, maxResults: '1' }
      if (key) params.key = key
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams(params)}`
      )
      if (res.ok) {
        const data = await res.json()
        const item = data.items?.[0]
        if (item) {
          const links = item.volumeInfo?.imageLinks || {}
          const raw = links.extraLarge || links.large || links.thumbnail || links.smallThumbnail
          if (raw) {
            const cover = sanitizeCoverUrl(raw)
            if (isValidCoverUrl(cover)) return cover
          }
        }
      }
    } catch { /* fall through */ }
  }

  // ── 2. Build the search title ─────────────────────────────────────────────
  // Prefer the AniList canonical title for disambiguation (e.g. "Demon Slayer:
  // Kimetsu no Yaiba" beats just "Demon Slayer"), BUT only if it's Latin so we
  // don't send CJK characters to Google Books.
  const usableCanonical =
    canonicalTitle && isLatinTitle(canonicalTitle)
      ? cleanTitleForSearch(canonicalTitle)
      : null
  const baseTitle = usableCanonical || cleanTitleForSearch(title)

  // Strip chars that confuse quoted Google Books queries (colons, parens, etc.)
  const safeTitle = baseTitle.replace(/[:"'()[\]]/g, ' ').replace(/\s+/g, ' ').trim()

  // The full stored title sometimes has a subtitle (e.g. "Naruto, Vol. 10: A
  // Splendid Ninja"). Searching for the EXACT full title is the most precise
  // query — add it as the first attempt.
  const exactTitle = title.replace(/['"]/g, '').trim()

  const queries = [
    `"${exactTitle}"`,                                 // exact stored title (most precise)
    `"${safeTitle}" "volume ${volNum}" manga`,
    `"${safeTitle}" "vol ${volNum}" manga`,
    `intitle:"${safeTitle}" intitle:"${volNum}"`,
  ]

  // ── 3. Volume-number validation patterns ─────────────────────────────────
  // BUG-FIX: the old bare `\b${volNum}\b` pattern was too loose — it matched
  // ANY occurrence of the digit (e.g. "Vol 2" in a subtitle would pass the
  // check for vol 16 if "16" happened to appear in a review snippet).
  // New patterns require the number to appear in a genuine volume context:
  //   • "Vol. 3" / "vol 03" (explicit "vol" prefix)
  //   • "Volume 3" (long form)
  //   • "#3" (comic-book hash format)
  //   • Title ends with bare number: "Attack on Titan 3" / "Silent Voice 02"
  //   • Zero-padded variants: "02" for volume 2
  const volStr = String(volNum)
  const volPatterns = [
    new RegExp(`vol\\.?\\s*0*${volStr}\\b`, 'i'),          // "Vol. 3", "vol 03"
    new RegExp(`volume\\s*0*${volStr}\\b`, 'i'),            // "Volume 3"
    new RegExp(`#\\s*0*${volStr}\\b`, 'i'),                 // "#3"
    new RegExp(`[\\s,]0*${volStr}\\s*$`),                   // ends with " 3", ", 3", " 03"
  ]

  for (const q of queries) {
    try {
      await sleep(API_DELAY_MS)
      const params: Record<string, string> = {
        q,
        maxResults: '8',
        printType: 'books',
      }
      if (key) params.key = key
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams(params)}`
      )
      if (!res.ok) continue
      const data = await res.json()

      // Collect all valid candidates and pick the BEST match, not just the
      // first above the threshold. This stops spin-offs that happen to rank
      // first from winning over the correct series.
      let bestCover: string | null = null
      let bestScore = 0

      for (const item of data.items || []) {
        const info = item.volumeInfo
        const resultTitle: string = info?.title || ''

        // Score against both the safe query title AND the original entry title
        const simBase = titleSimilarity(safeTitle, resultTitle)
        const simOrig = titleSimilarity(title, resultTitle)
        const sim = Math.max(simBase, simOrig)
        if (sim < SIMILARITY_THRESHOLD) continue

        // Must confirm the correct volume number in the result title/subtitle
        const fullText = `${resultTitle} ${info?.subtitle || ''}`.toLowerCase()
        if (!volPatterns.some(p => p.test(fullText))) continue

        const links = info?.imageLinks
        const raw = links?.extraLarge || links?.large || links?.thumbnail || links?.smallThumbnail
        if (!raw) continue

        const cover = sanitizeCoverUrl(raw)
        if (!isValidCoverUrl(cover)) continue

        if (sim > bestScore) {
          bestScore = sim
          bestCover = cover
        }
      }

      if (bestCover) return bestCover
    } catch { /* try next query */ }
  }

  return null
}

// ─── Store interface ──────────────────────────────────────────────────────────
interface EnrichProgress {
  total: number
  done: number
  current: string
  active: boolean
  fixed: number   // covers successfully updated this run
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

  // ─── Read ─────────────────────────────────────────────────────────────────
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

  // ─── Write ────────────────────────────────────────────────────────────────
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

  // ─── ISBN lookup (barcode scanner) ───────────────────────────────────────
  lookupByISBN: async (isbn) => {
    try {
      const key =
        localStorage.getItem('google_books_api_key') ||
        import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''
      const params: Record<string, string> = { q: `isbn:${isbn}`, maxResults: '1' }
      if (key) params.key = key
      const qs = new URLSearchParams(params).toString()
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${qs}`)
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

  // ─── Cover enrichment ────────────────────────────────────────────────────
  //
  // Waterfall (same for ALL series regardless of language):
  //   1. AniList  — best manga database, covers all languages
  //   2. Jikan    — MAL data, great fallback with best-match selection
  //   3. Google Books — last resort, useful for specific English publisher editions
  //
  // forceRefetch: true  → re-checks every series, including those with existing covers
  // forceRefetch: false → only processes series with no cover (default)
  //
  enrichCovers: async (options = {}) => {
    const { forceRefetch = false } = options
    enrichCancelled = false

    const targets = forceRefetch
      ? get().entries
      : get().entries.filter(e => !e.series.cover_image_url)

    // De-duplicate by series_id so multi-volume imports don't repeat work
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

        const volNum = extractVolumeNumber(title)
        const storedKey = localStorage.getItem('google_books_api_key') || undefined

        if (volNum !== null) {
          // ── Volume-specific entry (e.g. "Attack on Titan Vol. 3") ────────
          // Google Books has per-volume covers; AniList/Jikan only have the
          // series cover (always Vol. 1), so we skip their cover for these.

          // ── 1. AniList first — get canonical title for disambiguation ─────
          // AniList knows "Demon Slayer" → "Demon Slayer: Kimetsu no Yaiba".
          // Passing the full canonical title to Google Books prevents spin-offs
          // or adaptations with a similar short name from winning.
          const aliResult = await fetchAniListCover(title)
          if (aliResult) {
            metaUpdates = aliResult.meta
            // NOTE: intentionally NOT using aliResult.cover — AniList always
            // returns the series cover (vol 1). Using it here would reproduce
            // the exact bug we're fixing.
          }

          // ── 2. Google Books volume-specific cover (primary) ───────────────
          coverUrl = await fetchVolumeSpecificCover(
            title,
            volNum,
            entry.series.isbn,
            storedKey,
            aliResult?.matchedTitle  // disambiguates e.g. Demon Slayer vs Kimetsu Academy
          )

          // ── 3. Jikan — metadata only for the same reason ─────────────────
          if (!metaUpdates.description || !metaUpdates.total_volumes) {
            const jResult = await fetchJikanCover(title)
            if (jResult) {
              metaUpdates = { ...jResult.meta, ...metaUpdates }
            }
          }
        } else {
          // ── Series-level entry (no volume number in title) ────────────────
          // Best path: AniList → Jikan → Google Books

          // ── 1. AniList ────────────────────────────────────────────────────
          const aliResult = await fetchAniListCover(title)
          if (aliResult) {
            coverUrl = aliResult.cover
            metaUpdates = aliResult.meta
          }

          // ── 2. Jikan fallback ─────────────────────────────────────────────
          if (!coverUrl) {
            const jResult = await fetchJikanCover(title)
            if (jResult) {
              coverUrl = jResult.cover
              // Merge meta — prefer AniList descriptions when available
              metaUpdates = { ...jResult.meta, ...metaUpdates }
            }
          }

          // ── 3. Google Books last resort ───────────────────────────────────
          if (!coverUrl) {
            await sleep(API_DELAY_MS)
            const gbResult = await fetchGoogleBooksCover(title, storedKey)
            if (gbResult) {
              coverUrl = gbResult.cover
            }
          }
        }

        // ── Save ──────────────────────────────────────────────────────────
        const updates: Partial<Series> = { ...metaUpdates }

        // Only save the cover URL if it's valid; don't overwrite a good cover
        // with nothing, and don't save a bad URL
        if (coverUrl && isValidCoverUrl(coverUrl)) {
          updates.cover_image_url = coverUrl
        } else if (forceRefetch && !coverUrl) {
          // In force mode, clear a broken existing URL so it shows placeholder
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
