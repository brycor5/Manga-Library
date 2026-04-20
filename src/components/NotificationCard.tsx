import { ExternalLink, Check, BookOpen } from 'lucide-react'
import { useNotificationStore } from '../store/notificationStore'
import { useCollectionStore } from '../store/collectionStore'
import type { AppNotification } from '../types'

interface NotificationCardProps {
  notification: AppNotification
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBD'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr: string | null): string | null {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0) return 'Released'
  if (diff === 0) return 'Today!'
  if (diff === 1) return 'Tomorrow'
  if (diff <= 7) return `In ${diff} days`
  if (diff <= 30) return `In ${Math.ceil(diff / 7)} weeks`
  return null
}

export default function NotificationCard({ notification }: NotificationCardProps) {
  const { markRead } = useNotificationStore()
  const entries = useCollectionStore(s => s.entries)
  const series = entries.find(e => e.series_id === notification.series_id)?.series

  const isRead = !!notification.read_at
  const countdown = daysUntil(notification.release_date)
  const links = notification.buy_links || {}

  return (
    <div
      className={`flex gap-4 p-4 rounded-xl border transition-colors ${
        isRead
          ? 'bg-ink-900/40 border-ink-800/50 opacity-60'
          : 'bg-ink-900 border-ink-700'
      }`}
    >
      {/* Cover thumbnail */}
      <div className="w-10 h-14 bg-ink-800 rounded-lg overflow-hidden flex-shrink-0 border border-ink-700">
        {series?.cover_image_url ? (
          <img src={series.cover_image_url} alt={series.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={14} className="text-ink-600" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-snug truncate">
              {series?.title ?? 'Unknown Series'}
            </p>
            <p className="text-ink-400 text-sm">{notification.volume_label}</p>
          </div>

          {/* Unread indicator / mark read */}
          {!isRead && (
            <button
              onClick={() => markRead(notification.id)}
              title="Mark as read"
              className="flex-shrink-0 w-6 h-6 rounded-full bg-ink-800 hover:bg-ink-700 border border-ink-600 flex items-center justify-center text-ink-400 hover:text-white transition-colors"
            >
              <Check size={12} />
            </button>
          )}
        </div>

        {/* Date + countdown */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-ink-400 text-xs">{formatDate(notification.release_date)}</span>
          {countdown && !isRead && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              countdown === 'Today!' || countdown === 'Tomorrow'
                ? 'bg-accent-600/20 text-accent-300 border-accent-600/30'
                : countdown === 'Released'
                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                  : 'bg-ink-800 text-ink-400 border-ink-700'
            }`}>
              {countdown}
            </span>
          )}
        </div>

        {/* Buy links */}
        {(links.amazon || links.bn || links.crunchyroll) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-ink-600 text-xs">Buy:</span>
            {links.amazon && (
              <a
                href={links.amazon}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-ink-400 hover:text-white bg-ink-800 hover:bg-ink-700 border border-ink-700 rounded px-2 py-0.5 transition-colors"
              >
                Amazon <ExternalLink size={10} />
              </a>
            )}
            {links.bn && (
              <a
                href={links.bn}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-ink-400 hover:text-white bg-ink-800 hover:bg-ink-700 border border-ink-700 rounded px-2 py-0.5 transition-colors"
              >
                B&amp;N <ExternalLink size={10} />
              </a>
            )}
            {links.crunchyroll && (
              <a
                href={links.crunchyroll}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-ink-400 hover:text-white bg-ink-800 hover:bg-ink-700 border border-ink-700 rounded px-2 py-0.5 transition-colors"
              >
                Crunchyroll <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
