import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Collection from './pages/Collection'
import SeriesDetail from './pages/SeriesDetail'
import Browse from './pages/Browse'
import Import from './pages/Import'
import Rankings from './pages/Rankings'
import Progress from './pages/Progress'
import Settings from './pages/Settings'

export default function App() {
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
      </Route>
    </Routes>
  )
}
