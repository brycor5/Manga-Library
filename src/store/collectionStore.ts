import { create } from 'zustand'
import axios from 'axios'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Series, CollectionEntry, CollectionEntryWithSeries } from '../types'

const JIKAN_BASE = 'https://api.jikan.moe/v4'
const RATE_LIMIT_MS = 400 // Jikan allows ~3 req/s

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Strip volume/season/part suffixes for cleaner searches
// e.g. "Attack on Titan Season 1 Part 1" → "Attack on Titan"
function cleanTitleForSearch(title: string): string {
  return title
    .replace(/\s+(vol(ume)?|season|part|#|omnibus|deluxe|boxset|box set)[\s\d]*.*/i, '')
    .replace(/\s+\d+$/, '')
    .trim()
}

async function fetchGoogleBooksCover(title: string, apiKey?: string): Promise<string | null> {
  const cleanTitle = cleanTitleForSearch(title)
  const key = apiKey || import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''
  const params: Record<string, string> = {
    q: `intitle:"${cleanTitle}" manga`,
    maxResults: '5',
    printType: 'books',
    langRestrict: 'en',
  }
  if (key) params.key = key

  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${qs}`)
  if (!res.ok) return null
  const data = await res.json()

  for (const item of data.items || []) {
    const links = item.volumeInfo?.imageLinks
    const thumb = links?.extraLarge || links?.large || links?.thumbnail || links?.smallThumbnail
    if (thumb) {
      return thumb
        .replace('zoom=1', 'zoom=3')
        .replace('&edge=curl', '')
        .replace('http://', 'https://')
    }
  }
  return null
}

async function fetchAniListCover(title: string): Promise<{ cover: string | null; meta: Partial<Series> }> {
  const cleanTitle = cleanTitleForSearch(title)
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($search: String) {
        Media(search: $search, type: MANGA) {
          coverImage { extraLarge large }
          volumes status genres
          description(asHtml: false)
        }
      }`,
      variables: { search: cleanTitle },
    }),
  })
  if (!res.ok) return { cover: null, meta: {} }
  const data = await res.json()
  const m = data?.data?.Media
  if (!m) return { cover: null, meta: {} }

  return {
    cover: m.coverImage?.extraLarge || m.coverImage?.large || null,
    meta: {
      description: m.description ?? undefined,
      total_volumes: m.volumes ?? undefined,
      status: m.status === 'FINISHED' ? 'Complete' : m.status === 'RELEASING' ? 'Ongoing' : undefined,
      genre: m.genres?.length ? m.genres : undefined,
    },
  }
}

interface EnrichProgress {
  total: number
  done: number
  current: string
  active: boolean
}

interface CollectionState {
  entries: CollectionEntryWithSeries[]
  loading: boolean
  error: string | null
  enrichProgress: EnrichProgress | null

  // Actions
  fetchCollection: () => Promise<void>
  addSeries: (series: Omit<Series, 'id' | 'created_at' | 'updated_at'>, entry: Omit<CollectionEntry, 'id' | 'series_id' | 'series'>) => Promise<void>
  updateEntry: (id: string, updates: Partial<CollectionEntry>) => Promise<void>
  updateSeries: (id: string, updates: Partial<Series>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  importEntries: (data: Array<{ series: Omit<Series, 'id' | 'created_at' | 'updated_at'>, entry: Omit<CollectionEntry, 'id' | 'series_id' | 'series'> }>) => Promise<{ imported: number; skipped: number }>
  enrichCovers: () => Promise<void>
  cancelEnrich: () => void
}

let enrichCancelled = false

export const useCollectionStore = create<CollectionState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,
  enrichProgress: null,

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
        entries: state.entries.map(e => e.id === id ? { ...e, ...updates } : e)
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
        )
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

  enrichCovers: async () => {
    enrichCancelled = false
    const missing = get().entries.filter(e => !e.series.cover_image_url)
    if (missing.length === 0) return

    set({ enrichProgress: { total: missing.length, done: 0, current: '', active: true } })

    for (let i = 0; i < missing.length; i++) {
      if (enrichCancelled) break

      const entry = missing[i]
      const title = entry.series.title

      set(s => ({
        enrichProgress: s.enrichProgress
          ? { ...s.enrichProgress, done: i, current: title }
          : null
      }))

      try {
        await sleep(RATE_LIMIT_MS)

        const isJapanese = entry.series.language === 'Japanese'
        let coverUrl: string | null = null
        let metaUpdates: Partial<Series> = {}

        if (isJapanese) {
          // ── Japanese: AniList → Jikan fallback ─────────────────────
          try {
            const { cover, meta } = await fetchAniListCover(title)
            coverUrl = cover
            metaUpdates = meta
          } catch { /* continue */ }

          if (!coverUrl) {
            try {
              await sleep(RATE_LIMIT_MS)
              const jRes = await axios.get(`${JIKAN_BASE}/manga`, {
                params: { q: cleanTitleForSearch(title), limit: 1 },
                timeout: 8000,
              })
              const match = jRes.data?.data?.[0]
              if (match) {
                coverUrl = match.images?.jpg?.large_image_url || match.images?.jpg?.image_url || null
                metaUpdates = {
                  description: match.synopsis ?? undefined,
                  total_volumes: match.volumes ?? undefined,
                  status: match.status === 'Finished' ? 'Complete' : match.status === 'Publishing' ? 'Ongoing' : undefined,
                  genre: match.genres?.length ? match.genres.map((g: any) => g.name) : undefined,
                  demographic: match.demographics?.[0]?.name?.toLowerCase() ?? undefined,
                }
              }
            } catch { /* skip */ }
          }
        } else {
          // ── English (default): Google Books → AniList fallback ──────
          try {
            const storedKey = localStorage.getItem('google_books_api_key') || undefined
            coverUrl = await fetchGoogleBooksCover(title, storedKey)
          } catch { /* continue */ }

          // Always get metadata from AniList regardless of cover source
          try {
            const { cover: aliCover, meta } = await fetchAniListCover(title)
            metaUpdates = meta
            if (!coverUrl) coverUrl = aliCover // use AniList cover as fallback
          } catch { /* skip */ }
        }

        // ── Save ────────────────────────────────────────────────────
        const updates: Partial<Series> = { ...metaUpdates }
        if (coverUrl) updates.cover_image_url = coverUrl
        if (Object.keys(updates).length > 0) {
          await get().updateSeries(entry.series_id, updates)
        }

      } catch { /* skip this series entirely */ }
    }

    set({ enrichProgress: null })
    await get().fetchCollection()
  },
}))
