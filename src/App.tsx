import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useNotificationStore } from './store/notificationStore'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Collection from './pages/Collection'
import SeriesDetail from './pages/SeriesDetail'
import Browse from './pages/Browse'
import Import from './pages/Import'
import Rankings from './pages/Rankings'
import Progress from './pages/Progress'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'

// Lazy-load Scan so ZXing doesn't bloat the initial bundle
const Scan = lazy(() => import('./pages/Scan'))

export default function App() {
  const { fetchNotifications, subscribeRealtime } = useNotificationStore()

  useEffect(() => {
    fetchNotifications()
    const unsubscribe = subscribeRealtime()
    return unsubscribe
  }, [fetchNotifications, subscribeRealtime])

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="collection" element={<Collection />} />
        <Route path="collection/:id" element={<SeriesDetail />} />
        <Route path="browse" element={<Browse />} />
        <Route path="import" element={<Import />} />
        <Route path="rankings" element={<Rankings />} />
        <Route path="progress" element={<Progress />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route
          path="scan"
          element={
            <Suspense fallback={<div className="flex items-center justify-center h-screen text-ink-400">Loading scanner…</div>}>
              <Scan />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}
