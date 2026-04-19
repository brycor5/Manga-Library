import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, BookOpen } from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import type { CollectionEntryWithSeries, Demographic } from '../types'

const TIER_LABELS: Record<number, string> = {
  10: 'Masterpiece',
  9: 'Excellent',
  8: 'Great',
  7: 'Good',
  6: 'Fine',
  5: 'Average',
  4: 'Below Average',
  3: 'Bad',
  2: 'Very Bad',
  1: 'Terrible',
}

const TIER_COLORS: Record<number, string> = {
  10: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10',
  9: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  8: 'text-lime-300 border-lime-500/30 bg-lime-500/10',
  7: 'text-green-300 border-green-500/30 bg-green-500/10',
  6: 'text-teal-300 border-teal-500/30 bg-teal-500/10',
  5: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  4: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
  3: 'text-purple-300 border-purple-500/30 bg-purple-500/10',
  2: 'text-pink-300 border-pink-500/30 bg-pink-500/10',
  1: 'text-red-300 border-red-500/30 bg-red-500/10',
}

function TierRow({ entry, rank }: { entry: CollectionEntryWithSeries; rank: number }) {
  return (
    <Link
      to={`/collection/${entry.id}`}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-800 transition-colors group"
    >
      <span className="w-6 text-center text-ink-500 text-xs flex-shrink-0">#{rank}</span>
      <div className="w-8 h-12 rounded overflow-hidden bg-ink-700 flex-shrink-0">
        {entry.series.cover_image_url
          ? <img src={entry.series.cover_image_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><BookOpen size={12} className="text-ink-500" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ink-100 group-hover:text-white font-medium text-sm truncate">{entry.series.title}</p>
        <p className="text-ink-500 text-xs">{entry.series.author || '—'} · <span className="capitalize">{entry.series.demographic || 'unknown'}</span></p>
      </div>
    </Link>
  )
}

export default function Rankings() {
  const { entries, loading, fetchCollection, updateEntry } = useCollectionStore()
  const [filterDemographic, setFilterDemographic] = useState<Demographic | ''>('')
  const [filterGenre, setFilterGenre] = useState('')
  const [quickRate, setQuickRate] = useState<Record<string, number>>({})

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const allGenres = useMemo(() => {
    const genres = new Set<string>()
    entries.forEach(e => e.series.genre?.forEach(g => genres.add(g)))
    return Array.from(genres).sort()
  }, [entries])

  const { rated, unrated } = useMemo(() => {
    let list = [...entries]
    if (filterDemographic) list = list.filter(e => e.series.demographic === filterDemographic)
    if (filterGenre) list = list.filter(e => e.series.genre?.includes(filterGenre))

    const rated = list.filter(e => e.rating).sort((a, b) => (b.rating || 0) - (a.rating || 0))
    const unrated = list.filter(e => !e.rating)
    return { rated, unrated }
  }, [entries, filterDemographic, filterGenre])

  const tiers = useMemo(() => {
    const groups: Record<number, CollectionEntryWithSeries[]> = {}
    for (let i = 10; i >= 1; i--) groups[i] = rated.filter(e => e.rating === i)
    return groups
  }, [rated])

  let globalRank = 0

  if (loading && entries.length === 0) return <div className="flex items-center justify-center h-64 text-ink-500">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Rankings</h1>
        <p className="text-ink-400">Your personal ratings — {rated.length} series rated</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <select value={filterDemographic} onChange={e => setFilterDemographic(e.target.value as any)} className="input text-sm">
          <option value="">All demographics</option>
          {['shonen', 'seinen', 'shojo', 'josei', 'BL', 'GL'].map(d => <option key={d}>{d}</option>)}
        </select>
        <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)} className="input text-sm">
          <option value="">All genres</option>
          {allGenres.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {rated.length === 0 && entries.length > 0 && (
        <div className="text-center py-16 text-ink-500">
          <Star size={40} className="mx-auto mb-3 text-ink-700" />
          <p>No ratings yet — go to a series detail page to rate it!</p>
        </div>
      )}

      {/* Tier groups */}
      <div className="space-y-6">
        {Array.from({ length: 10 }, (_, i) => 10 - i).map(score => {
          const group = tiers[score]
          if (group.length === 0) return null
          return (
            <div key={score}>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold mb-3 ${TIER_COLORS[score]}`}>
                <Star size={12} className="fill-current" /> {score}/10 — {TIER_LABELS[score]}
              </div>
              <div className="card divide-y divide-ink-800/50">
                {group.map(entry => {
                  globalRank++
                  return <TierRow key={entry.id} entry={entry} rank={globalRank} />
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Unrated */}
      {unrated.length > 0 && (
        <div className="mt-10">
          <h2 className="text-ink-400 font-semibold mb-3 text-sm uppercase tracking-wider">Unrated ({unrated.length})</h2>
          <div className="card divide-y divide-ink-800/50">
            {unrated.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 p-2">
                <div className="w-8 h-12 rounded overflow-hidden bg-ink-700 flex-shrink-0">
                  {entry.series.cover_image_url
                    ? <img src={entry.series.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><BookOpen size={12} className="text-ink-500" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/collection/${entry.id}`} className="text-ink-200 hover:text-white font-medium text-sm truncate block">{entry.series.title}</Link>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button
                      key={n}
                      onClick={async () => {
                        setQuickRate(r => ({ ...r, [entry.id]: n }))
                        await updateEntry(entry.id, { rating: n })
                      }}
                      className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                        n <= (quickRate[entry.id] || 0)
                          ? 'bg-yellow-500 text-ink-950'
                          : 'bg-ink-800 text-ink-500 hover:bg-ink-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
