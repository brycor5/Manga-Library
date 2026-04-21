import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Grid3X3, List, Search, SlidersHorizontal, X, BookOpen, Star, Sparkles, Loader2, XCircle } from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import type { CollectionEntryWithSeries, ReadingStatus, Demographic } from '../types'

type ViewMode = 'grid' | 'list'
type SortKey = 'title' | 'author' | 'rating' | 'date_added' | 'volumes_owned' | 'progress'

const STATUS_COLORS: Record<ReadingStatus, string> = {
  'Reading': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Completed': 'bg-green-500/20 text-green-300 border-green-500/30',
  'Plan to Read': 'bg-ink-700 text-ink-300 border-ink-600',
  'Dropped': 'bg-red-500/20 text-red-300 border-red-500/30',
  'On Hold': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

function CoverCard({ entry }: { entry: CollectionEntryWithSeries }) {
  const progress = entry.series.total_volumes
    ? Math.round((entry.volumes_owned / entry.series.total_volumes) * 100)
    : null

  return (
    <Link to={`/collection/${entry.id}`} className="group flex flex-col">
      {/* Cover — fixed aspect ratio */}
      <div className="relative aspect-[2/3] bg-ink-800 rounded-lg overflow-hidden border border-ink-700 group-hover:border-ink-500 transition-colors">
        {entry.series.cover_image_url ? (
          <img
            src={entry.series.cover_image_url}
            alt={entry.series.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={28} className="text-ink-700" />
          </div>
        )}
        {entry.rating && (
          <div className="absolute top-2 right-2 bg-ink-900/90 rounded-md px-1.5 py-0.5 flex items-center gap-1">
            <Star size={10} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-white font-semibold">{entry.rating}</span>
          </div>
        )}
        {entry.wishlist && (
          <div className="absolute top-2 left-2 bg-accent-600/90 rounded-md px-1.5 py-0.5">
            <span className="text-xs text-white font-semibold">Wishlist</span>
          </div>
        )}
      </div>

      {/* Info — fixed height so all cards align */}
      <div className="mt-2 flex flex-col gap-1 min-h-[3.5rem]">
        <p className="text-sm font-medium text-ink-100 group-hover:text-white transition-colors leading-snug line-clamp-2">{entry.series.title}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className={`badge border ${STATUS_COLORS[entry.reading_status]} text-xs`}>
            {entry.reading_status}
          </span>
          {entry.volumes_owned > 0 && (
            <span className="text-ink-500 text-xs">
              {entry.volumes_owned}{entry.series.total_volumes ? `/${entry.series.total_volumes}` : ''} vol
            </span>
          )}
        </div>
        {progress !== null && progress > 0 && (
          <div className="h-1 bg-ink-700 rounded-full overflow-hidden">
            <div className="h-full bg-accent-600 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
      </div>
    </Link>
  )
}

function ListRow({ entry }: { entry: CollectionEntryWithSeries }) {
  return (
    <Link to={`/collection/${entry.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-ink-800 transition-colors group">
      <div className="w-10 h-14 bg-ink-700 rounded overflow-hidden flex-shrink-0">
        {entry.series.cover_image_url ? (
          <img src={entry.series.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={14} className="text-ink-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink-100 group-hover:text-white truncate">{entry.series.title}</p>
        <p className="text-ink-500 text-sm truncate">{entry.series.author || 'Unknown author'}</p>
      </div>
      <span className={`badge border ${STATUS_COLORS[entry.reading_status]} flex-shrink-0 hidden sm:flex`}>
        {entry.reading_status}
      </span>
      <div className="text-right flex-shrink-0 hidden md:block">
        <p className="text-ink-200 text-sm font-medium">{entry.volumes_owned}{entry.series.total_volumes ? `/${entry.series.total_volumes}` : ''}</p>
        <p className="text-ink-500 text-xs">volumes</p>
      </div>
      {entry.rating ? (
        <div className="flex items-center gap-1 flex-shrink-0 hidden md:flex">
          <Star size={12} className="text-yellow-400 fill-yellow-400" />
          <span className="text-ink-200 text-sm font-semibold">{entry.rating}/10</span>
        </div>
      ) : (
        <div className="w-12 hidden md:block" />
      )}
    </Link>
  )
}

function EnrichBanner() {
  const { entries, enrichProgress, enrichCovers, cancelEnrich } = useCollectionStore()
  const missingCount = entries.filter(e => !e.series.cover_image_url).length

  if (enrichProgress?.active) {
    const pct = enrichProgress.total > 0
      ? Math.round((enrichProgress.done / enrichProgress.total) * 100)
      : 0
    return (
      <div className="mb-4 bg-blue-900/30 border border-blue-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-blue-300 text-sm font-medium">
            <Loader2 size={14} className="animate-spin" />
            Fetching covers… {enrichProgress.done}/{enrichProgress.total}
            {enrichProgress.fixed > 0 && (
              <span className="text-green-400 font-semibold">· {enrichProgress.fixed} found</span>
            )}
          </div>
          <button onClick={cancelEnrich} className="text-blue-400 hover:text-white transition-colors">
            <XCircle size={16} />
          </button>
        </div>
        <div className="h-1.5 bg-blue-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {enrichProgress.current && (
          <p className="text-blue-400 text-xs mt-1.5 truncate">Looking up: {enrichProgress.current}</p>
        )}
      </div>
    )
  }

  if (entries.length === 0) return null

  return (
    <div className="mb-4 bg-ink-800 border border-ink-700 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
      <div>
        {missingCount > 0 ? (
          <>
            <p className="text-white font-medium text-sm">{missingCount} series missing cover art</p>
            <p className="text-ink-400 text-xs mt-0.5">
              Searches AniList → MAL → Google Books with title-matching to find the right cover
            </p>
          </>
        ) : (
          <>
            <p className="text-white font-medium text-sm">All covers loaded</p>
            <p className="text-ink-400 text-xs mt-0.5">
              Re-fetch to fix any wrong or low-quality covers
            </p>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {missingCount > 0 && (
          <button
            onClick={() => enrichCovers()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Sparkles size={14} />
            Fetch Missing
          </button>
        )}
        <button
          onClick={() => enrichCovers({ forceRefetch: true })}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Sparkles size={14} />
          Re-fetch All
        </button>
      </div>
    </div>
  )
}

export default function Collection() {
  const { entries, loading, fetchCollection } = useCollectionStore()
  const [view, setView] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    status: '' as ReadingStatus | '',
    demographic: '' as Demographic | '',
    publisher: '',
    wishlist: false,
    complete: false,
  })
  const [sortKey, setSortKey] = useState<SortKey>('date_added')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const filtered = useMemo(() => {
    let list = [...entries]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.series.title.toLowerCase().includes(q) ||
        (e.series.author || '').toLowerCase().includes(q)
      )
    }
    if (filters.status) list = list.filter(e => e.reading_status === filters.status)
    if (filters.demographic) list = list.filter(e => e.series.demographic === filters.demographic)
    if (filters.publisher) list = list.filter(e => e.series.publisher?.toLowerCase().includes(filters.publisher.toLowerCase()))
    if (filters.wishlist) list = list.filter(e => e.wishlist)
    if (filters.complete) list = list.filter(e => e.is_complete_in_collection)

    list.sort((a, b) => {
      let av: any, bv: any
      switch (sortKey) {
        case 'title': av = a.series.title; bv = b.series.title; break
        case 'author': av = a.series.author || ''; bv = b.series.author || ''; break
        case 'rating': av = a.rating || 0; bv = b.rating || 0; break
        case 'date_added': av = a.date_added; bv = b.date_added; break
        case 'volumes_owned': av = a.volumes_owned; bv = b.volumes_owned; break
        case 'progress':
          av = a.series.total_volumes ? a.volumes_owned / a.series.total_volumes : 0
          bv = b.series.total_volumes ? b.volumes_owned / b.series.total_volumes : 0
          break
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [entries, search, filters, sortKey, sortDir])

  const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== false).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">My Collection</h1>
          <p className="text-ink-400 mt-1">{filtered.length} series{search || activeFilterCount > 0 ? ` (filtered from ${entries.length})` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-ink-900 border border-ink-700 rounded-lg p-1 flex">
            <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}>
              <Grid3X3 size={16} />
            </button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-ink-700 text-white' : 'text-ink-400 hover:text-white'}`}>
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Search + Filters bar */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title or author…"
            className="input w-full pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="input text-sm">
            <option value="date_added">Date Added</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="rating">Rating</option>
            <option value="volumes_owned">Volumes</option>
            <option value="progress">Progress</option>
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="btn-secondary px-3 text-lg font-bold">
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <button
          onClick={() => setShowFilters(f => !f)}
          className={`btn-secondary flex items-center gap-2 ${activeFilterCount > 0 ? 'border-accent-600 text-accent-400' : ''}`}
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilterCount > 0 && <span className="bg-accent-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Enrich banner */}
      <EnrichBanner />

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 mb-4 flex flex-wrap gap-4">
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Status</label>
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))} className="input text-sm">
              <option value="">All</option>
              {['Reading', 'Completed', 'Plan to Read', 'Dropped', 'On Hold'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Demographic</label>
            <select value={filters.demographic} onChange={e => setFilters(f => ({ ...f, demographic: e.target.value as any }))} className="input text-sm">
              <option value="">All</option>
              {['shonen', 'seinen', 'shojo', 'josei', 'BL', 'GL'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Publisher</label>
            <input value={filters.publisher} onChange={e => setFilters(f => ({ ...f, publisher: e.target.value }))} placeholder="Filter publisher…" className="input text-sm" />
          </div>
          <div className="flex flex-col gap-2 pt-4">
            <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer">
              <input type="checkbox" checked={filters.wishlist} onChange={e => setFilters(f => ({ ...f, wishlist: e.target.checked }))} className="accent-accent-600" />
              Wishlist only
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-300 cursor-pointer">
              <input type="checkbox" checked={filters.complete} onChange={e => setFilters(f => ({ ...f, complete: e.target.checked }))} className="accent-accent-600" />
              Complete sets only
            </label>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ status: '', demographic: '', publisher: '', wishlist: false, complete: false })} className="text-accent-500 hover:text-accent-400 text-sm flex items-center gap-1">
              <X size={14} /> Clear all
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-ink-500">Loading collection…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <BookOpen size={40} className="text-ink-700 mb-3" />
          <p className="text-ink-400 font-medium">No series found</p>
          <p className="text-ink-600 text-sm mt-1">
            {entries.length === 0 ? 'Import a CSV or browse to add your first series' : 'Try adjusting your filters'}
          </p>
          {entries.length === 0 && (
            <div className="flex gap-3 mt-4">
              <Link to="/import" className="btn-primary text-sm">Import CSV</Link>
              <Link to="/browse" className="btn-secondary text-sm">Browse Manga</Link>
            </div>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
          {filtered.map(e => <CoverCard key={e.id} entry={e} />)}
        </div>
      ) : (
        <div className="card divide-y divide-ink-800">
          {filtered.map(e => <ListRow key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  )
}
