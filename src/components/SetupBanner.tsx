import { AlertTriangle } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'

export default function SetupBanner() {
  if (isSupabaseConfigured) return null
  return (
    <div className="bg-yellow-900/40 border-b border-yellow-700/50 px-4 py-2 flex items-center gap-3 text-sm">
      <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
      <span className="text-yellow-200">
        Supabase not connected — add <code className="bg-yellow-900/60 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
        <code className="bg-yellow-900/60 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to{' '}
        <code className="bg-yellow-900/60 px-1 rounded">.env.local</code> to enable data sync.
      </span>
    </div>
  )
}
