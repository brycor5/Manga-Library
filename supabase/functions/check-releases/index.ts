import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, serviceRoleKey)

const MU_BASE = 'https://api.mangaupdates.com/v1'
const LOOKAHEAD_DAYS = 60

interface WatchlistRow {
  id: string
  series_id: string
  mu_series_id: number | null
}

interface SeriesRow {
  id: string
  title: string
  isbn: string | null
}

/** Build retailer buy links from ISBN or title */
function buildBuyLinks(isbn: string | null, title: string): Record<string, string> {
  const links: Record<string, string> = {}
  const encodedTitle = encodeURIComponent(title)
  if (isbn) {
    links.amazon = `https://www.amazon.com/s?k=${encodeURIComponent(isbn)}`
    links.bn = `https://www.barnesandnoble.com/s/${encodeURIComponent(isbn)}`
  } else {
    links.amazon = `https://www.amazon.com/s?k=${encodedTitle}+manga`
    links.bn = `https://www.barnesandnoble.com/s/${encodedTitle}`
  }
  links.crunchyroll = `https://store.crunchyroll.com/search?q=${encodedTitle}`
  return links
}

/** Parse a MangaUpdates release date string into a YYYY-MM-DD or null */
function parseReleaseDate(raw: string | null): string | null {
  if (!raw) return null
  // MangaUpdates returns dates in various formats: "2025-07-15", "Jul 2025", etc.
  const full = raw.match(/^\d{4}-\d{2}-\d{2}$/)
  if (full) return raw
  const partial = raw.match(/^(\w+)\s+(\d{4})$/)
  if (partial) {
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    }
    const m = months[partial[1]]
    if (m) return `${partial[2]}-${m}-01`
  }
  return null
}

Deno.serve(async (_req: Request) => {
  try {
    // 1. Fetch all watched series that have a MangaUpdates ID
    const { data: watchlist, error: wErr } = await supabase
      .from('release_watchlist')
      .select('id, series_id, mu_series_id')
      .not('mu_series_id', 'is', null)

    if (wErr) throw wErr
    if (!watchlist?.length) {
      return new Response(JSON.stringify({ message: 'No watched series with MU IDs' }), { status: 200 })
    }

    // 2. Fetch series metadata for buy links
    const seriesIds = watchlist.map((w: WatchlistRow) => w.series_id)
    const { data: seriesRows } = await supabase
      .from('series')
      .select('id, title, isbn')
      .in('id', seriesIds)

    const seriesMap = new Map<string, SeriesRow>(
      (seriesRows || []).map((s: SeriesRow) => [s.id, s])
    )

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + LOOKAHEAD_DAYS)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]

    let inserted = 0
    let skipped = 0

    for (const row of watchlist as WatchlistRow[]) {
      try {
        // Rate-limit: 1 req per 300ms to be polite to MangaUpdates
        await new Promise(r => setTimeout(r, 300))

        const res = await fetch(`${MU_BASE}/releases/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            search: row.mu_series_id,
            search_type: 'series',
            include_metadata: true,
            perpage: 10,
            orderby: 'date',
          }),
        })

        if (!res.ok) { skipped++; continue }
        const data = await res.json()
        const releases: any[] = data?.results || []

        const series = seriesMap.get(row.series_id)
        if (!series) { skipped++; continue }

        for (const r of releases) {
          const vol = r.record?.volume
          if (!vol) continue

          const releaseDate = parseReleaseDate(r.record?.release_date ?? null)

          // Only notify for future releases within the lookahead window
          if (releaseDate && releaseDate < todayStr) continue
          if (releaseDate && releaseDate > cutoffStr) continue

          const volumeLabel = `Volume ${vol}`
          const buyLinks = buildBuyLinks(series.isbn, series.title)

          // Upsert — unique constraint on (series_id, volume_label) prevents duplicates
          const { error: uErr } = await supabase
            .from('notifications')
            .upsert(
              {
                series_id: row.series_id,
                volume_label: volumeLabel,
                release_date: releaseDate,
                buy_links: buyLinks,
              },
              { onConflict: 'series_id,volume_label', ignoreDuplicates: true }
            )

          if (!uErr) inserted++
          else skipped++
        }
      } catch {
        skipped++
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, skipped, watched: watchlist.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('check-releases error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 })
  }
})
