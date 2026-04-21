import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNotificationStore } from '../store/notificationStore'

interface WatchlistToggleProps {
  seriesId: string
  seriesTitle: string
  language?: string | null
}

export default function WatchlistToggle({ seriesId, seriesTitle, language }: WatchlistToggleProps) {
  const { isWatched, toggleWatchlist } = useNotificationStore()
  const [loading, setLoading] = useState(false)

  // Only offer tracking for English-licensed titles (MangaUpdates coverage)
  if (language && language !== 'English') return null

  const watched = isWatched(seriesId)

  async function handleToggle() {
    setLoading(true)
    await toggleWatchlist(seriesId, seriesTitle)
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={watched ? 'Stop watching for new releases' : 'Get notified when new volumes release'}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
        watched
          ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25'
          : 'bg-ink-800 text-ink-400 border-ink-700 hover:text-ink-100 hover:bg-ink-700'
      }`}
    >
      {loading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : watched ? (
        <Bell size={15} className="fill-yellow-400" />
      ) : (
        <BellOff size={15} />
      )}
      <span>{watched ? 'Watching' : 'Watch Releases'}</span>
    </button>
  )
}
