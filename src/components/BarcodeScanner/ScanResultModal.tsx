import { useState } from 'react'
import { BookOpen, X, Plus, Heart, RotateCcw, Loader2, Star } from 'lucide-react'
import { useCollectionStore } from '../../store/collectionStore'
import type { GoogleBooksVolume } from '../../types'
import type { ReadingStatus } from '../../types'

interface ScanResultModalProps {
  result: GoogleBooksVolume
  onClose: () => void        // close without adding
  onRescan: () => void       // discard and scan again
  onAdded: () => void        // successfully added → navigate away
}

const STATUS_OPTIONS: ReadingStatus[] = ['Plan to Read', 'Reading', 'Completed', 'On Hold', 'Dropped']

export default function ScanResultModal({ result, onClose, onRescan, onAdded }: ScanResultModalProps) {
  const { addSeries } = useCollectionStore()

  const [readingStatus, setReadingStatus] = useState<ReadingStatus>('Plan to Read')
  const [volumesOwned, setVolumesOwned] = useState(1)
  const [rating, setRating] = useState<number | ''>('')
  const [wishlist, setWishlist] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(asWishlist = false) {
    setSaving(true)
    setError(null)
    try {
      await addSeries(
        {
          title: result.title,
          author: result.authors.join(', ') || null,
          artist: null,
          publisher: result.publisher || null,
          original_publisher: null,
          demographic: null,
          genre: [],
          total_volumes: null,
          total_pages: result.pageCount || null,
          status: 'Unknown',
          language: 'English',
          format: 'Single',
          isbn: result.isbn || null,
          upc: null,
          msrp: null,
          cover_image_url: result.thumbnail || null,
          description: result.description || null,
          mal_id: null,
        },
        {
          reading_status: asWishlist ? 'Plan to Read' : readingStatus,
          volumes_owned: asWishlist ? 0 : volumesOwned,
          volumes_read: 0,
          rating: rating !== '' ? Number(rating) : null,
          notes: null,
          date_added: new Date().toISOString(),
          wishlist: asWishlist,
          is_complete_in_collection: false,
        }
      )
      onAdded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-ink-900 border border-ink-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-800">
          <h2 className="text-white font-semibold">Book Found</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Book info */}
        <div className="flex gap-4 p-5">
          <div className="w-16 h-24 bg-ink-800 rounded-lg overflow-hidden flex-shrink-0 border border-ink-700">
            {result.thumbnail ? (
              <img src={result.thumbnail} alt={result.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={20} className="text-ink-600" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold leading-snug line-clamp-2">{result.title}</p>
            {result.authors.length > 0 && (
              <p className="text-ink-400 text-sm mt-0.5 truncate">{result.authors.join(', ')}</p>
            )}
            {result.publisher && (
              <p className="text-ink-500 text-xs mt-0.5 truncate">{result.publisher}</p>
            )}
            {result.isbn && (
              <p className="text-ink-600 text-xs mt-1 font-mono">ISBN: {result.isbn}</p>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="px-5 pb-2 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Reading Status</label>
              <select
                value={readingStatus}
                onChange={e => setReadingStatus(e.target.value as ReadingStatus)}
                className="input w-full text-sm"
              >
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Volumes Owned</label>
              <input
                type="number"
                min={0}
                value={volumesOwned}
                onChange={e => setVolumesOwned(Math.max(0, Number(e.target.value)))}
                className="input w-full text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-400 mb-1 flex items-center gap-1 block">
              <Star size={11} className="text-yellow-400" /> Rating (1–10, optional)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={rating}
              onChange={e => setRating(e.target.value === '' ? '' : Math.min(10, Math.max(1, Number(e.target.value))))}
              placeholder="—"
              className="input w-full text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex flex-col gap-2 border-t border-ink-800 mt-2">
          <button
            onClick={() => handleAdd(false)}
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Add to Collection
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAdd(true)}
              disabled={saving}
              className="btn-secondary flex items-center justify-center gap-2 text-sm"
            >
              <Heart size={14} />
              Add to Wishlist
            </button>
            <button
              onClick={onRescan}
              disabled={saving}
              className="btn-secondary flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw size={14} />
              Scan Again
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
