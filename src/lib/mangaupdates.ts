const MU_BASE = 'https://api.mangaupdates.com/v1'

export interface MURelease {
  series_id: number
  volume: string | null
  chapter: string | null
  release_date: string | null  // "YYYY-MM-DD" or partial
  publisher: string | null
}

/** Find a MangaUpdates series ID by title. Returns null if not found. */
export async function findMuSeriesId(title: string): Promise<number | null> {
  try {
    const res = await fetch(`${MU_BASE}/series/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: title, stype: 'title', perpage: 5 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const results: any[] = data?.results || []
    if (results.length === 0) return null
    // Pick the best match — first result is typically most relevant
    return results[0]?.record?.series_id ?? null
  } catch {
    return null
  }
}

/** Fetch upcoming English volume releases for a MangaUpdates series. */
export async function fetchMuReleases(muSeriesId: number): Promise<MURelease[]> {
  try {
    const res = await fetch(`${MU_BASE}/releases/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search: muSeriesId,
        search_type: 'series',
        include_metadata: true,
        perpage: 10,
        orderby: 'date',
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.results || []).map((r: any) => ({
      series_id: muSeriesId,
      volume: r.record?.volume ?? null,
      chapter: r.record?.chapter ?? null,
      release_date: r.record?.release_date ?? null,
      publisher: r.record?.publisher?.publisher_name ?? null,
    }))
  } catch {
    return []
  }
}
