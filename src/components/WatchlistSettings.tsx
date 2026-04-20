import { useNotificationStore } from '../store/notificationStore'

interface WatchlistSettingsProps {
  seriesId: string
}

export default function WatchlistSettings({ seriesId }: WatchlistSettingsProps) {
  const { watchlist, updateWatchlistPrefs } = useNotificationStore()
  const entry = watchlist.find(w => w.series_id === seriesId)
  if (!entry) return null

  function toggle(field: 'notify_inapp' | 'notify_push' | 'notify_email') {
    if (!entry) return
    updateWatchlistPrefs(seriesId, { [field]: !entry[field] })
  }

  return (
    <div className="mt-3 pl-1 flex flex-col gap-2">
      <p className="text-ink-500 text-xs font-medium uppercase tracking-wider">Notify me via</p>
      {[
        { key: 'notify_inapp' as const, label: 'In-app bell', desc: 'Badge in the sidebar' },
        { key: 'notify_push' as const, label: 'Browser push', desc: 'Phone / desktop pop-up (coming soon)' },
        { key: 'notify_email' as const, label: 'Email', desc: 'Weekly digest (coming soon)' },
      ].map(({ key, label, desc }) => (
        <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={entry[key]}
            onChange={() => toggle(key)}
            className="mt-0.5 accent-accent-600 cursor-pointer"
            disabled={key !== 'notify_inapp'}
          />
          <div>
            <span className={`text-sm font-medium ${key !== 'notify_inapp' ? 'text-ink-600' : 'text-ink-300 group-hover:text-white transition-colors'}`}>
              {label}
            </span>
            <p className="text-ink-600 text-xs">{desc}</p>
          </div>
        </label>
      ))}
    </div>
  )
}
