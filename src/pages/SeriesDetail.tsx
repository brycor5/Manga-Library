import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Star, BookOpen, Heart, CheckCircle, Trash2,
  ChevronDown, Edit2, Save, X
} from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import type { CollectionEntryWithSeries, ReadingStatus } from '../types'

const STATUS_OPTIONS: ReadingStatus[] = ['Reading', 'Completed', 'Plan to Read', 'Dropped', 'On Hold']

const DEMOGRAPHIC_COLORS: Record<string, string> = {
  shonen: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  seinen: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  shojo: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  josei: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  BL: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  GL: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
}

function ProgressBar({ value, max, color = 'bg-accent-600', label }: { value: number; max: number; color?: string; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-ink-400">{label}</span>
        <span className="text-ink-200 font-medium">{value} / {max} <span className="text-ink-500">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-ink-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function RatingWidget({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          className={`w-8 h-8 rounded font-bold text-sm transition-colors ${
            n <= (hover ?? value ?? 0)
              ? 'bg-yellow-500 text-ink-950'
              : 'bg-ink-800 text-ink-500 hover:bg-ink-700'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { entries, updateEntry, updateSeries, deleteEntry } = useCollectionStore()

  const entry = entries.find(e => e.id === id) as CollectionEntryWithSeries | undefined

  const [editNotes, setEditNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (entry) setNotes(entry.notes || '')
  }, [entry])

  if (!entry) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <BookOpen size={40} className="text-ink-700 mb-3" />
        <p className="text-ink-400">Series not found</p>
        <Link to="/collection" className="btn-secondary mt-4 text-sm">Back to Collection</Link>
      </div>
    )
  }

  const s = entry.series
  const collectionValue = s.msrp && entry.volumes_owned ? s.msrp * entry.volumes_owned : null

  const handleUpdate = (updates: Parameters<typeof updateEntry>[1]) => updateEntry(entry.id, updates)

  const handleDelete = async () => {
    await deleteEntry(entry.id)
    navigate('/collection')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link to="/collection" className="inline-flex items-center gap-2 text-ink-400 hover:text-white mb-6 text-sm transition-colors">
        <ArrowLeft size={16} /> Back to Collection
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-8">
        {/* Left: Cover + quick actions */}
        <div>
          <div className="aspect-[2/3] bg-ink-800 rounded-xl overflow-hidden border border-ink-700 mb-4">
            {s.cover_image_url ? (
              <img src={s.cover_image_url} alt={s.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-ink-600">
                <BookOpen size={48} />
                <p className="text-sm mt-2">No cover</p>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleUpdate({ wishlist: !entry.wishlist })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                entry.wishlist ? 'bg-accent-600/20 border-accent-600/50 text-accent-400' : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-white hover:bg-ink-700'
              }`}
            >
              <Heart size={15} className={entry.wishlist ? 'fill-accent-500' : ''} />
              {entry.wishlist ? 'Wishlisted' : 'Wishlist'}
            </button>
            <button
              onClick={() => handleUpdate({
                is_complete_in_collection: true,
                volumes_owned: s.total_volumes || entry.volumes_owned,
              })}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                entry.is_complete_in_collection ? 'bg-green-600/20 border-green-600/50 text-green-400' : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-white hover:bg-ink-700'
              }`}
            >
              <CheckCircle size={15} />
              {entry.is_complete_in_collection ? 'Complete' : 'Mark Complete'}
            </button>
          </div>

          {/* ISBN/UPC */}
          {(s.isbn || s.upc) && (
            <details className="text-xs text-ink-500 mt-2">
              <summary className="cursor-pointer hover:text-ink-300 transition-colors">Show ISBN/UPC</summary>
              <div className="mt-2 space-y-1 pl-2">
                {s.isbn && <p><span className="text-ink-600">ISBN:</span> {s.isbn}</p>}
                {s.upc && <p><span className="text-ink-600">UPC:</span> {s.upc}</p>}
              </div>
            </details>
          )}
        </div>

        {/* Right: Details */}
        <div className="space-y-6">
          {/* Title + meta */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {s.demographic && (
                <span className={`badge border ${DEMOGRAPHIC_COLORS[s.demographic] || 'bg-ink-700 text-ink-300 border-ink-600'}`}>
                  {s.demographic}
                </span>
              )}
              <span className={`badge border ${s.status === 'Complete' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
                {s.status}
              </span>
              {s.genre.slice(0, 3).map(g => (
                <span key={g} className="badge bg-ink-800 text-ink-400 border border-ink-700">{g}</span>
              ))}
            </div>
            <h1 className="text-3xl font-black text-white mb-1">{s.title}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-400 text-sm">
              {s.author && <span>Author: <span className="text-ink-200">{s.author}</span></span>}
              {s.artist && s.artist !== s.author && <span>Art: <span className="text-ink-200">{s.artist}</span></span>}
              {s.publisher && <span>Publisher: <span className="text-ink-200">{s.publisher}</span></span>}
              <span>Format: <span className="text-ink-200">{s.format}</span></span>
              <span>Language: <span className="text-ink-200">{s.language}</span></span>
            </div>
          </div>

          {/* Description */}
          {s.description && (
            <p className="text-ink-300 text-sm leading-relaxed line-clamp-4">{s.description}</p>
          )}

          {/* Progress bars */}
          <div className="card p-4 space-y-4">
            <ProgressBar
              label="Volumes Owned"
              value={entry.volumes_owned}
              max={s.total_volumes || entry.volumes_owned}
              color="bg-accent-600"
            />
            <ProgressBar
              label="Volumes Read"
              value={entry.volumes_read}
              max={entry.volumes_owned}
              color="bg-blue-500"
            />
            {/* Inline volume editors */}
            <div className="flex gap-4 pt-2">
              <div>
                <label className="text-xs text-ink-500 block mb-1">Owned</label>
                <input
                  type="number"
                  min={0}
                  value={entry.volumes_owned}
                  onChange={e => handleUpdate({ volumes_owned: parseInt(e.target.value) || 0 })}
                  className="input w-20 text-center"
                />
              </div>
              <div>
                <label className="text-xs text-ink-500 block mb-1">Read</label>
                <input
                  type="number"
                  min={0}
                  max={entry.volumes_owned}
                  value={entry.volumes_read}
                  onChange={e => handleUpdate({ volumes_read: parseInt(e.target.value) || 0 })}
                  className="input w-20 text-center"
                />
              </div>
              {s.msrp && (
                <div className="ml-auto text-right">
                  <p className="text-xs text-ink-500 mb-1">Collection Value</p>
                  <p className="text-ink-100 font-semibold">${collectionValue?.toFixed(2)}</p>
                  <p className="text-ink-600 text-xs">${s.msrp}/vol</p>
                </div>
              )}
            </div>
          </div>

          {/* Reading status */}
          <div>
            <label className="text-xs text-ink-500 block mb-2">Reading Status</label>
            <div className="relative inline-block">
              <select
                value={entry.reading_status}
                onChange={e => handleUpdate({ reading_status: e.target.value as ReadingStatus })}
                className="input pr-8 appearance-none cursor-pointer"
              >
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="text-xs text-ink-500 block mb-2">Your Rating</label>
            <RatingWidget
              value={entry.rating}
              onChange={v => handleUpdate({ rating: v || null })}
            />
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-ink-500">Personal Notes</label>
              {editNotes ? (
                <div className="flex gap-2">
                  <button onClick={() => { handleUpdate({ notes }); setEditNotes(false) }} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                    <Save size={12} /> Save
                  </button>
                  <button onClick={() => { setNotes(entry.notes || ''); setEditNotes(false) }} className="text-xs text-ink-500 hover:text-ink-300 flex items-center gap-1">
                    <X size={12} /> Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditNotes(true)} className="text-xs text-ink-500 hover:text-ink-300 flex items-center gap-1">
                  <Edit2 size={12} /> Edit
                </button>
              )}
            </div>
            {editNotes ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes about this series…"
                className="input w-full resize-none"
              />
            ) : (
              <p className="text-ink-300 text-sm min-h-[3rem] bg-ink-800/50 rounded-lg p-3 border border-ink-800">
                {entry.notes || <span className="text-ink-600 italic">No notes yet</span>}
              </p>
            )}
          </div>

          {/* Danger zone */}
          <div className="border-t border-ink-800 pt-4">
            {confirmDelete ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <p className="text-red-300 text-sm mb-3">Remove <strong>{s.title}</strong> from your collection?</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium">Yes, remove</button>
                  <button onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-ink-600 hover:text-red-400 text-sm flex items-center gap-1.5 transition-colors">
                <Trash2 size={14} /> Remove from collection
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
