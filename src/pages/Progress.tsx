import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, CheckCircle, Clock, PauseCircle, XCircle, TrendingUp } from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import type { CollectionEntryWithSeries } from '../types'

const AVG_PAGES_PER_VOLUME = 200
const WORDS_PER_PAGE = 100
const READING_SPEED_WPM = 250

function ProgressEntry({ entry }: { entry: CollectionEntryWithSeries }) {
  const pct = entry.volumes_owned > 0
    ? Math.round((entry.volumes_read / entry.volumes_owned) * 100)
    : 0

  return (
    <Link to={`/collection/${entry.id}`} className="flex items-center gap-3 group hover:bg-ink-800 rounded-lg p-2 -mx-2 transition-colors">
      <div className="w-10 h-14 rounded overflow-hidden bg-ink-700 flex-shrink-0">
        {entry.series.cover_image_url
          ? <img src={entry.series.cover_image_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><BookOpen size={12} className="text-ink-500" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ink-100 group-hover:text-white font-medium text-sm truncate">{entry.series.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-ink-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-ink-400 flex-shrink-0">{entry.volumes_read}/{entry.volumes_owned} vol ({pct}%)</span>
        </div>
      </div>
    </Link>
  )
}

function Section({ title, icon: Icon, entries, color, emptyMsg }: {
  title: string
  icon: any
  entries: CollectionEntryWithSeries[]
  color: string
  emptyMsg: string
}) {
  if (entries.length === 0) return null
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className={color} />
        <h2 className="font-bold text-white">{title}</h2>
        <span className="ml-auto text-ink-500 text-sm">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-ink-600 text-sm">{emptyMsg}</p>
      ) : (
        <div className="space-y-1">
          {entries.map(e => <ProgressEntry key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  )
}

export default function Progress() {
  const { entries, loading, fetchCollection } = useCollectionStore()

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const groups = useMemo(() => ({
    reading: entries.filter(e => e.reading_status === 'Reading').sort((a, b) => {
      const pa = a.volumes_owned > 0 ? a.volumes_read / a.volumes_owned : 0
      const pb = b.volumes_owned > 0 ? b.volumes_read / b.volumes_owned : 0
      return pb - pa
    }),
    completed: entries.filter(e => e.reading_status === 'Completed'),
    planToRead: entries.filter(e => e.reading_status === 'Plan to Read').sort((a, b) => (a.series.total_volumes || 999) - (b.series.total_volumes || 999)),
    dropped: entries.filter(e => e.reading_status === 'Dropped'),
    onHold: entries.filter(e => e.reading_status === 'On Hold'),
  }), [entries])

  const overallStats = useMemo(() => {
    const totalVolsRead = entries.reduce((s, e) => s + e.volumes_read, 0)
    const totalPagesRead = totalVolsRead * AVG_PAGES_PER_VOLUME
    const totalWords = totalPagesRead * WORDS_PER_PAGE
    const readingMinutes = totalWords / READING_SPEED_WPM
    const readingHours = Math.round(readingMinutes / 60)

    return {
      totalVolsRead,
      totalPagesRead,
      completedSeries: groups.completed.length,
      readingHours,
    }
  }, [entries, groups.completed.length])

  if (loading && entries.length === 0) return <div className="flex items-center justify-center h-64 text-ink-500">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Reading Progress</h1>
        <p className="text-ink-400">Track where you are in everything</p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Volumes Read', value: overallStats.totalVolsRead.toLocaleString() },
          { label: 'Pages Read', value: overallStats.totalPagesRead.toLocaleString() },
          { label: 'Series Completed', value: overallStats.completedSeries },
          { label: 'Est. Read Time', value: `${overallStats.readingHours.toLocaleString()}h` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-3 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-ink-400 text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <Section title="Currently Reading" icon={BookOpen} entries={groups.reading} color="text-blue-400" emptyMsg="Nothing in progress" />
      <Section title="Completed" icon={CheckCircle} entries={groups.completed} color="text-green-400" emptyMsg="No completed series yet" />
      <Section title="Plan to Read" icon={Clock} entries={groups.planToRead} color="text-ink-400" emptyMsg="Your backlog is empty" />
      <Section title="On Hold" icon={PauseCircle} entries={groups.onHold} color="text-yellow-400" emptyMsg="" />
      <Section title="Dropped" icon={XCircle} entries={groups.dropped} color="text-red-400" emptyMsg="" />

      {entries.length === 0 && (
        <div className="text-center py-16">
          <TrendingUp size={40} className="mx-auto text-ink-700 mb-3" />
          <p className="text-ink-400">No series in your collection yet</p>
          <div className="flex gap-3 justify-center mt-4">
            <Link to="/import" className="btn-primary text-sm">Import CSV</Link>
            <Link to="/browse" className="btn-secondary text-sm">Browse Manga</Link>
          </div>
        </div>
      )}
    </div>
  )
}
