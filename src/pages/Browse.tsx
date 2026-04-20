import { useState, useCallback } from 'react'
import { Search, Plus, Heart, BookOpen, Loader2, X, ExternalLink } from 'lucide-react'
import axios from 'axios'
import { useCollectionStore } from '../store/collectionStore'
import type { JikanManga, Series, CollectionEntry, Demographic } from '../types'

const JIKAN_BASE = 'https://api.jikan.moe/v4'

function mapJikanToSeries(m: JikanManga): Omit<Series, 'id' | 'created_at' | 'updated_at'> {
  const author = m.authors?.find(a => a.type === 'Story')?.name || m.authors?.[0]?.name || null
  const artist = m.authors?.find(a => a.type === 'Art')?.name || null
  const demographic = (m.demographics?.[0]?.name?.toLowerCase() as Demographic) || null
  return {
    title: m.title_english || m.title,
    author: author ? author.replace(', ', ' ').split(' ').reverse().join(' ') : null,
    artist: artist ? artist.replace(', ', ' ').split(' ').reverse().join(' ') : null,
    publisher: m.serializations?.[0]?.name || null,
    original_publisher: m.serializations?.[0]?.name || null,
    demographic,
    genre: m.genres?.map(g => g.name) || [],
    total_volumes: m.volumes,
    total_pages: m.volumes ? m.volumes * 200 : null,
    status: m.status === 'Finished' ? 'Complete' : m.status === 'Publishing' ? 'Ongoing' : 'Unknown' as any,
    language: 'English',
    format: 'Single',
    isbn: null,
    upc: null,
    msrp: null,
    cover_image_url: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || null,
    description: m.synopsis,
    mal_id: m.mal_id,
  }
}

function MangaCard({ manga, onAdd, onWishlist, added }: {
  manga: JikanManga
  onAdd: (...args: any[]) => void
  onWishlist: (...args: any[]) => void
  added: 'collection' | 'wishlist' | null
}) {
  return (
    <div className="card overflow-hidden group">
      <div className="aspect-[2/3] bg-ink-800 overflow-hidden">
        {manga.images?.jpg?.image_url ? (
          <img
            src={manga.images.jpg.image_url}
            alt={manga.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={32} className="text-ink-600" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="font-semibold text-ink-100 text-sm leading-tight line-clamp-2">{manga.title_english || manga.title}</p>
        <div className="flex flex-wrap gap-1">
          {manga.demographics?.[0] && (
            <span className="badge bg-ink-800 text-ink-400 border border-ink-700 capitalize">{manga.demographics[0].name.toLowerCase()}</span>
          )}
          {manga.genres?.slice(0, 2).map(g => (
            <span key={g.name} className="badge bg-ink-800 text-ink-500 border border-ink-700">{g.name}</span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span>{manga.volumes ? `${manga.volumes} vols` : 'Ongoing'}</span>
          <span className={manga.status === 'Finished' ? 'text-green-500' : 'text-blue-400'}>
            {manga.status === 'Finished' ? 'Complete' : 'Ongoing'}
          </span>
        </div>
        {added ? (
          <div className={`text-center text-xs py-1.5 rounded-lg font-medium ${added === 'collection' ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-accent-600/20 text-accent-400 border border-accent-600/30'}`}>
            {added === 'collection' ? '✓ Added to Collection' : '♥ Added to Wishlist'}
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onAdd} className="flex-1 btn-primary text-xs py-1.5 flex items-center justify-center gap-1">
              <Plus size={12} /> Add
            </button>
            <button onClick={onWishlist} className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1">
              <Heart size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Browse() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<JikanManga[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Record<number, 'collection' | 'wishlist'>>({})
  const [selected, setSelected] = useState<JikanManga | null>(null)
  const [addingId, setAddingId] = useState<number | null>(null)

  const { addSeries } = useCollectionStore()

  const search = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.get(`${JIKAN_BASE}/manga`, {
        params: { q: query, limit: 20, order_by: 'popularity' }
      })
      setResults(data.data || [])
    } catch {
      setError('Search failed — the Jikan API may be rate-limited. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleAdd = async (manga: JikanManga, wishlist = false) => {
    setAddingId(manga.mal_id)
    try {
      const seriesData = mapJikanToSeries(manga)
      const entryData: Omit<CollectionEntry, 'id' | 'series_id' | 'series'> = {
        volumes_owned: wishlist ? 0 : 1,
        volumes_read: 0,
        reading_status: wishlist ? 'Plan to Read' : 'Plan to Read',
        rating: null,
        notes: null,
        date_added: new Date().toISOString().split('T')[0],
        wishlist,
        is_complete_in_collection: false,
      }
      await addSeries(seriesData, entryData)
      setAdded(a => ({ ...a, [manga.mal_id]: wishlist ? 'wishlist' : 'collection' }))
      setSelected(null)
    } catch (err) {
      setError('Failed to add series. Check your Supabase connection.')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Browse & Discover</h1>
        <p className="text-ink-400">Search the MyAnimeList database to find and add manga to your collection.</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 max-w-lg mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search manga title…"
            className="input w-full pl-9"
          />
        </div>
        <button onClick={search} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </div>

      {error && (
        <div className="bg-accent-900/30 border border-accent-800 rounded-lg p-3 mb-6 text-accent-300 text-sm">{error}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          <p className="text-ink-400 text-sm mb-4">{results.length} results for "<span className="text-ink-200">{query}</span>"</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.map(manga => (
              <div key={manga.mal_id} onClick={() => setSelected(manga)} className="cursor-pointer">
                <MangaCard
                  manga={manga}
                  added={added[manga.mal_id] || null}
                  onAdd={async (e: any) => { e?.stopPropagation?.(); await handleAdd(manga, false) }}
                  onWishlist={async (e: any) => { e?.stopPropagation?.(); await handleAdd(manga, true) }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && results.length === 0 && query && (
        <div className="text-center py-16 text-ink-500">No results found for "{query}"</div>
      )}

      {results.length === 0 && !query && (
        <div className="text-center py-16">
          <Search size={40} className="mx-auto text-ink-700 mb-3" />
          <p className="text-ink-400">Search for any manga title above</p>
          <p className="text-ink-600 text-sm mt-1">Powered by the Jikan API (MyAnimeList)</p>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start p-4 border-b border-ink-800">
              <p className="font-bold text-white">{selected.title_english || selected.title}</p>
              <button onClick={() => setSelected(null)} className="text-ink-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-4 flex gap-4">
              <div className="w-28 flex-shrink-0">
                {selected.images?.jpg?.image_url && (
                  <img src={selected.images.jpg.image_url} alt="" className="w-full rounded-lg" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {selected.demographics?.[0] && <span className="badge bg-accent-600/20 text-accent-400 border border-accent-600/30 capitalize">{selected.demographics[0].name.toLowerCase()}</span>}
                  {selected.genres?.slice(0, 4).map(g => <span key={g.name} className="badge bg-ink-800 text-ink-400 border border-ink-700">{g.name}</span>)}
                </div>
                {selected.authors?.[0] && <p className="text-sm text-ink-300">By {selected.authors[0].name}</p>}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-400">
                  <span>Volumes: <span className="text-ink-200">{selected.volumes || '?'}</span></span>
                  <span>Status: <span className={selected.status === 'Finished' ? 'text-green-400' : 'text-blue-400'}>{selected.status === 'Finished' ? 'Complete' : 'Ongoing'}</span></span>
                  {selected.score && <span>MAL Score: <span className="text-yellow-400">{selected.score}</span></span>}
                </div>
                {selected.synopsis && <p className="text-ink-400 text-xs line-clamp-4">{selected.synopsis}</p>}
                <a href={`https://myanimelist.net/manga/${selected.mal_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-300">
                  View on MAL <ExternalLink size={10} />
                </a>
              </div>
            </div>
            <div className="p-4 border-t border-ink-800 flex gap-3">
              {added[selected.mal_id] ? (
                <p className="text-green-400 text-sm">{added[selected.mal_id] === 'collection' ? '✓ Added to Collection' : '♥ Added to Wishlist'}</p>
              ) : (
                <>
                  <button
                    onClick={() => handleAdd(selected, false)}
                    disabled={addingId === selected.mal_id}
                    className="btn-primary flex items-center gap-2"
                  >
                    {addingId === selected.mal_id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add to Collection
                  </button>
                  <button
                    onClick={() => handleAdd(selected, true)}
                    disabled={addingId === selected.mal_id}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Heart size={14} /> Wishlist
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
