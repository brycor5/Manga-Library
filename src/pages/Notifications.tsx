import { useEffect, useMemo } from 'react'
import { Bell, BellOff, CheckCheck, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'
import { useCollectionStore } from '../store/collectionStore'
import NotificationCard from '../components/NotificationCard'
import type { AppNotification } from '../types'

function groupNotifications(notifs: AppNotification[]): {
  upcoming: AppNotification[]
  released: AppNotification[]
  read: AppNotification[]
} {
  const today = new Date().toISOString().split('T')[0]
  const upcoming: AppNotification[] = []
  const released: AppNotification[] = []
  const read: AppNotification[] = []

  for (const n of notifs) {
    if (n.read_at) {
      read.push(n)
    } else if (!n.release_date || n.release_date > today) {
      upcoming.push(n)
    } else {
      released.push(n)
    }
  }

  return { upcoming, released, read }
}

export default function Notifications() {
  const { notifications, watchlist, unreadCount, loading, fetchNotifications, fetchWatchlist, markAllRead } = useNotificationStore()
  const { fetchCollection } = useCollectionStore()

  useEffect(() => {
    fetchNotifications()
    fetchWatchlist()
    fetchCollection()
  }, [fetchNotifications, fetchWatchlist, fetchCollection])

  const { upcoming, released, read } = useMemo(() => groupNotifications(notifications), [notifications])

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Release Notifications</h1>
          <p className="text-ink-400 mt-1">
            {watchlist.length > 0
              ? `Watching ${watchlist.length} series for new volumes`
              : 'Watch series on their detail page to get release alerts'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-ink-500">
          <Loader2 size={24} className="animate-spin mr-2" />
          Loading…
        </div>
      ) : notifications.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-ink-800 rounded-2xl flex items-center justify-center mb-4 border border-ink-700">
            <BellOff size={28} className="text-ink-600" />
          </div>
          <p className="text-white font-semibold text-lg">No release notifications yet</p>
          <p className="text-ink-400 text-sm mt-2 max-w-xs">
            Open any English series in your collection and click{' '}
            <span className="text-accent-400 font-medium">Watch Releases</span> to start tracking.
          </p>
          {watchlist.length === 0 && (
            <Link to="/collection" className="btn-primary mt-6 text-sm">
              Go to My Collection
            </Link>
          )}
          {watchlist.length > 0 && (
            <p className="text-ink-500 text-xs mt-4">
              You're watching {watchlist.length} series. Check back after the daily refresh runs.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-accent-400" />
                <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Upcoming</h2>
                <span className="text-xs bg-accent-600/20 text-accent-400 border border-accent-600/30 rounded-full px-2 py-0.5">
                  {upcoming.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {upcoming.map(n => <NotificationCard key={n.id} notification={n} />)}
              </div>
            </section>
          )}

          {/* Recently released (unread) */}
          {released.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Out Now</h2>
                <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5">
                  {released.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {released.map(n => <NotificationCard key={n.id} notification={n} />)}
              </div>
            </section>
          )}

          {/* Read / seen */}
          {read.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-ink-600" />
                <h2 className="text-ink-500 font-semibold text-sm uppercase tracking-wider">Seen</h2>
              </div>
              <div className="flex flex-col gap-2">
                {read.map(n => <NotificationCard key={n.id} notification={n} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
