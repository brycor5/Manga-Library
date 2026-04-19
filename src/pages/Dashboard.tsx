import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { BookOpen, Library, Users, Building2, Star, TrendingUp } from 'lucide-react'
import { useCollectionStore } from '../store/collectionStore'
import type { CollectionEntryWithSeries, ReadingStatus } from '../types'

const STATUS_COLORS: Record<ReadingStatus, string> = {
  'Reading': '#3b82f6',
  'Completed': '#22c55e',
  'Plan to Read': '#6b7280',
  'Dropped': '#ef4444',
  'On Hold': '#eab308',
}

const AVG_PAGES_PER_VOLUME = 200

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-accent-600/20 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className="text-accent-500" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-ink-400 text-sm">{label}</p>
        {sub && <p className="text-ink-600 text-xs">{sub}</p>}
      </div>
    </div>
  )
}

function SeriesRow({ entry }: { entry: CollectionEntryWithSeries }) {
  return (
    <Link to={`/collection/${entry.id}`} className="flex items-center gap-3 group hover:bg-ink-800 rounded-lg p-2 -mx-2 transition-colors">
      <div className="w-8 h-12 rounded overflow-hidden bg-ink-700 flex-shrink-0">
        {entry.series.cover_image_url
          ? <img src={entry.series.cover_image_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><BookOpen size={12} className="text-ink-500" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-ink-100 group-hover:text-white text-sm font-medium truncate">{entry.series.title}</p>
        <p className="text-ink-500 text-xs truncate">{entry.series.author || '—'}</p>
      </div>
      {entry.rating && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Star size={11} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-ink-300">{entry.rating}</span>
        </div>
      )}
    </Link>
  )
}

export default function Dashboard() {
  const { entries, loading, fetchCollection } = useCollectionStore()

  useEffect(() => { fetchCollection() }, [fetchCollection])

  const stats = useMemo(() => {
    const totalVolumes = entries.reduce((s, e) => s + e.volumes_owned, 0)
    const totalSeries = entries.length
    const totalPagesRead = entries.reduce((s, e) => s + (e.volumes_read * AVG_PAGES_PER_VOLUME), 0)

    const completeSeries = entries.filter(e => e.is_complete_in_collection).length
    const oneshotSeries = entries.filter(e => e.series.total_volumes === 1).length

    const statusBreakdown = entries.reduce((acc, e) => {
      acc[e.reading_status] = (acc[e.reading_status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const demographicBreakdown = entries.reduce((acc, e) => {
      const d = e.series.demographic || 'unknown'
      acc[d] = (acc[d] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const uniqueAuthors = new Set(entries.map(e => e.series.author).filter(Boolean)).size
    const uniquePublishers = new Set(entries.map(e => e.series.publisher).filter(Boolean)).size

    const topRated = [...entries]
      .filter(e => e.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5)

    const recentlyAdded = [...entries]
      .sort((a, b) => b.date_added.localeCompare(a.date_added))
      .slice(0, 5)

    const currentlyReading = entries.filter(e => e.reading_status === 'Reading')

    return {
      totalVolumes, totalSeries, totalPagesRead, completeSeries, oneshotSeries,
      statusBreakdown, demographicBreakdown, uniqueAuthors, uniquePublishers,
      topRated, recentlyAdded, currentlyReading,
    }
  }, [entries])

  const statusChartData = Object.entries(stats.statusBreakdown).map(([name, value]) => ({ name, value }))
  const demographicChartData = Object.entries(stats.demographicBreakdown).map(([name, value]) => ({ name, value }))

  const DEMO_COLORS = ['#ff2d2d', '#3b82f6', '#ec4899', '#a855f7', '#6366f1', '#14b8a6', '#6b7280']

  if (loading && entries.length === 0) {
    return <div className="flex items-center justify-center h-screen text-ink-500">Loading…</div>
  }

  if (entries.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[80vh] text-center">
        <Library size={56} className="text-ink-700 mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to Manga Library</h1>
        <p className="text-ink-400 max-w-sm mb-8">Your collection is empty. Import a CSV or browse the Jikan database to get started.</p>
        <div className="flex gap-3">
          <Link to="/import" className="btn-primary">Import CSV</Link>
          <Link to="/browse" className="btn-secondary">Browse Manga</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-ink-400 mt-1">Your collection at a glance</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Library} label="Total Series" value={stats.totalSeries} />
        <StatCard icon={BookOpen} label="Total Volumes" value={stats.totalVolumes} />
        <StatCard icon={TrendingUp} label="Pages Read" value={stats.totalPagesRead.toLocaleString()} sub="estimated" />
        <StatCard icon={Star} label="Complete Sets" value={stats.completeSeries} sub={`${stats.oneshotSeries} oneshots`} />
      </div>

      {/* Charts + fun stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reading status donut */}
        <div className="card p-4">
          <p className="text-ink-300 font-semibold mb-3">Reading Status</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {statusChartData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name as ReadingStatus] || '#6b7280'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid #383838', borderRadius: '8px' }}
                labelStyle={{ color: '#e8e8e8' }}
                itemStyle={{ color: '#a8a8a8' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {statusChartData.map(({ name, value }) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[name as ReadingStatus] || '#6b7280' }} />
                  <span className="text-ink-400">{name}</span>
                </div>
                <span className="text-ink-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Demographic donut */}
        <div className="card p-4">
          <p className="text-ink-300 font-semibold mb-3">Demographic</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={demographicChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                {demographicChartData.map((entry, i) => (
                  <Cell key={entry.name} fill={DEMO_COLORS[i % DEMO_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #383838', borderRadius: '8px' }} itemStyle={{ color: '#a8a8a8' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {demographicChartData.map(({ name, value }, i) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: DEMO_COLORS[i % DEMO_COLORS.length] }} />
                  <span className="text-ink-400 capitalize">{name}</span>
                </div>
                <span className="text-ink-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fun stats */}
        <div className="card p-4 space-y-3">
          <p className="text-ink-300 font-semibold">Fun Stats</p>
          <div className="space-y-3">
            {[
              { icon: Users, label: 'Unique Authors', value: stats.uniqueAuthors },
              { icon: Building2, label: 'Publishers', value: stats.uniquePublishers },
              { icon: BookOpen, label: 'Incomplete Sets', value: stats.totalSeries - stats.completeSeries },
              { icon: TrendingUp, label: 'Volumes to Read', value: entries.reduce((s, e) => s + Math.max(0, e.volumes_owned - e.volumes_read), 0) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-ink-400 text-sm">
                  <Icon size={14} /> {label}
                </div>
                <span className="text-white font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Currently reading */}
      {stats.currentlyReading.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Currently Reading</h2>
            <Link to="/progress" className="text-sm text-ink-400 hover:text-white transition-colors">View Progress →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {stats.currentlyReading.map(entry => (
              <Link key={entry.id} to={`/collection/${entry.id}`} className="group">
                <div className="aspect-[2/3] bg-ink-800 rounded-lg overflow-hidden border border-ink-700 group-hover:border-ink-500 transition-colors mb-1.5">
                  {entry.series.cover_image_url
                    ? <img src={entry.series.cover_image_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><BookOpen size={24} className="text-ink-600" /></div>
                  }
                </div>
                <p className="text-xs font-medium text-ink-200 truncate">{entry.series.title}</p>
                <div className="mt-1 h-1 bg-ink-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{
                    width: `${entry.volumes_owned > 0 ? Math.round((entry.volumes_read / entry.volumes_owned) * 100) : 0}%`
                  }} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Rated */}
        {stats.topRated.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-white flex items-center gap-2"><Star size={16} className="text-yellow-400" /> Top Rated</h2>
              <Link to="/rankings" className="text-xs text-ink-400 hover:text-white">View all →</Link>
            </div>
            <div className="space-y-1">
              {stats.topRated.map(e => <SeriesRow key={e.id} entry={e} />)}
            </div>
          </div>
        )}

        {/* Recently Added */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">Recently Added</h2>
            <Link to="/collection" className="text-xs text-ink-400 hover:text-white">View all →</Link>
          </div>
          <div className="space-y-1">
            {stats.recentlyAdded.map(e => <SeriesRow key={e.id} entry={e} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
