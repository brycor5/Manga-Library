import { useState, useEffect } from 'react'
import { Download, Trash2, AlertTriangle, Info, Key, ExternalLink } from 'lucide-react'
import Papa from 'papaparse'
import { useCollectionStore } from '../store/collectionStore'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { entries, fetchCollection } = useCollectionStore()
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [gbKey, setGbKey] = useState('')
  const [gbKeySaved, setGbKeySaved] = useState(false)

  useEffect(() => {
    setGbKey(localStorage.getItem('google_books_api_key') || '')
  }, [])

  const saveGbKey = () => {
    localStorage.setItem('google_books_api_key', gbKey.trim())
    setGbKeySaved(true)
    setTimeout(() => setGbKeySaved(false), 2000)
  }

  const exportCSV = () => {
    const rows = entries.map(e => ({
      title: e.series.title,
      author: e.series.author || '',
      artist: e.series.artist || '',
      publisher: e.series.publisher || '',
      original_publisher: e.series.original_publisher || '',
      demographic: e.series.demographic || '',
      genre: e.series.genre?.join(', ') || '',
      total_volumes: e.series.total_volumes || '',
      status: e.series.status,
      language: e.series.language,
      format: e.series.format,
      isbn: e.series.isbn || '',
      upc: e.series.upc || '',
      msrp: e.series.msrp || '',
      cover_image_url: e.series.cover_image_url || '',
      mal_id: e.series.mal_id || '',
      volumes_owned: e.volumes_owned,
      volumes_read: e.volumes_read,
      reading_status: e.reading_status,
      rating: e.rating || '',
      notes: e.notes || '',
      date_added: e.date_added,
      wishlist: e.wishlist,
      is_complete_in_collection: e.is_complete_in_collection,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `manga-library-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = async () => {
    setClearing(true)
    try {
      // Delete all collection entries first (FK constraint)
      await supabase.from('collection_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('series').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await fetchCollection()
      setCleared(true)
      setConfirmClear(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Settings</h1>
        <p className="text-ink-400">Manage your data and preferences</p>
      </div>

      {/* Export */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2"><Download size={16} /> Export Collection</h2>
        <p className="text-ink-400 text-sm">Download your entire collection as a CSV file. Includes all series data, your volumes, ratings, and notes.</p>
        <button onClick={exportCSV} disabled={entries.length === 0} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Download size={16} />
          Export {entries.length} Series to CSV
        </button>
      </div>

      {/* Google Books API Key */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2"><Key size={16} /> Google Books API Key</h2>
        <p className="text-ink-400 text-sm">
          Used to fetch <strong className="text-white">English edition covers</strong> when enriching your collection.
          Without a key it still works but may hit rate limits on large collections.
        </p>
        <div className="flex gap-2">
          <input
            value={gbKey}
            onChange={e => setGbKey(e.target.value)}
            placeholder="AIza..."
            className="input flex-1 font-mono text-sm"
          />
          <button onClick={saveGbKey} className={`btn-primary text-sm px-4 ${gbKeySaved ? 'bg-green-600 hover:bg-green-500' : ''}`}>
            {gbKeySaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        <div className="text-xs text-ink-500 space-y-0.5">
          <p>Free key — 1,000 requests/day limit lifted to 1,000/minute with a key.</p>
          <a
            href="https://console.cloud.google.com/apis/library/books.googleapis.com"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent-400 hover:text-accent-300"
          >
            Get a free key from Google Cloud Console <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Supabase info */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold text-white flex items-center gap-2"><Info size={16} /> Database</h2>
        <p className="text-ink-400 text-sm">Connected to Supabase. Your data is stored in the cloud and synced across devices.</p>
        <div className="bg-ink-800 rounded-lg p-3 text-xs font-mono text-ink-400 break-all">
          {import.meta.env.VITE_SUPABASE_URL || 'No Supabase URL configured'}
        </div>
        <p className="text-ink-600 text-xs">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.</p>
      </div>

      {/* Danger zone */}
      <div className="card p-6 border-red-900/50 space-y-3">
        <h2 className="font-bold text-red-400 flex items-center gap-2"><AlertTriangle size={16} /> Danger Zone</h2>
        <p className="text-ink-400 text-sm">Permanently delete all series and collection data from your database. This cannot be undone.</p>

        {cleared && (
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-green-400 text-sm">
            All data has been cleared.
          </div>
        )}

        {confirmClear ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 space-y-3">
            <p className="text-red-300 text-sm font-medium">Are you sure? This will delete all {entries.length} series and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={clearAll} disabled={clearing} className="bg-red-600 hover:bg-red-500 text-white text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-50">
                {clearing ? 'Clearing…' : 'Yes, delete everything'}
              </button>
              <button onClick={() => setConfirmClear(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)} className="flex items-center gap-2 text-red-500 hover:text-red-400 border border-red-900 hover:border-red-700 px-4 py-2 rounded-lg text-sm transition-colors">
            <Trash2 size={14} /> Clear All Data
          </button>
        )}
      </div>

      {/* About */}
      <div className="text-ink-600 text-xs text-center space-y-1">
        <p>Manga Library v0.1 · Built with React + Supabase</p>
        <p>Cover art and metadata via Jikan API (MyAnimeList)</p>
      </div>
    </div>
  )
}
