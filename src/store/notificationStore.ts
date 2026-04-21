import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { findMuSeriesId } from '../lib/mangaupdates'
import type { WatchlistEntry, AppNotification } from '../types'

interface NotificationState {
  notifications: AppNotification[]
  watchlist: WatchlistEntry[]
  unreadCount: number
  loading: boolean
  error: string | null

  fetchNotifications: () => Promise<void>
  fetchWatchlist: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  isWatched: (seriesId: string) => boolean
  toggleWatchlist: (seriesId: string, seriesTitle: string) => Promise<void>
  updateWatchlistPrefs: (seriesId: string, prefs: Partial<Pick<WatchlistEntry, 'notify_inapp' | 'notify_push' | 'notify_email'>>) => Promise<void>
  subscribeRealtime: () => () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  watchlist: [],
  unreadCount: 0,
  loading: false,
  error: null,

  fetchNotifications: async () => {
    if (!isSupabaseConfigured) return
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('release_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      const notifs = (data as AppNotification[]) || []
      set({
        notifications: notifs,
        unreadCount: notifs.filter(n => !n.read_at).length,
        loading: false,
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  fetchWatchlist: async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data, error } = await supabase
        .from('release_watchlist')
        .select('*')
      if (error) throw error
      set({ watchlist: (data as WatchlistEntry[]) || [] })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  markRead: async (id: string) => {
    try {
      const readAt = new Date().toISOString()
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: readAt })
        .eq('id', id)
      if (error) throw error
      set(state => {
        const updated = state.notifications.map(n =>
          n.id === id ? { ...n, read_at: readAt } : n
        )
        return {
          notifications: updated,
          unreadCount: updated.filter(n => !n.read_at).length,
        }
      })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  markAllRead: async () => {
    try {
      const readAt = new Date().toISOString()
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: readAt })
        .is('read_at', null)
      if (error) throw error
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, read_at: n.read_at ?? readAt })),
        unreadCount: 0,
      }))
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  isWatched: (seriesId: string) => {
    return get().watchlist.some(w => w.series_id === seriesId)
  },

  toggleWatchlist: async (seriesId: string, seriesTitle: string) => {
    const existing = get().watchlist.find(w => w.series_id === seriesId)

    if (existing) {
      // Remove from watchlist
      try {
        const { error } = await supabase
          .from('release_watchlist')
          .delete()
          .eq('series_id', seriesId)
        if (error) throw error
        set(state => ({
          watchlist: state.watchlist.filter(w => w.series_id !== seriesId),
        }))
      } catch (err) {
        set({ error: (err as Error).message })
      }
    } else {
      // Add to watchlist, then lookup MangaUpdates ID in background
      try {
        const { data, error } = await supabase
          .from('release_watchlist')
          .insert({ series_id: seriesId })
          .select()
          .single()
        if (error) throw error

        const newEntry = data as WatchlistEntry
        set(state => ({ watchlist: [...state.watchlist, newEntry] }))

        // Background: find and cache the MangaUpdates series ID
        findMuSeriesId(seriesTitle).then(async muId => {
          if (!muId) return
          await supabase
            .from('release_watchlist')
            .update({ mu_series_id: muId })
            .eq('series_id', seriesId)
          set(state => ({
            watchlist: state.watchlist.map(w =>
              w.series_id === seriesId ? { ...w, mu_series_id: muId } : w
            ),
          }))
        })
      } catch (err) {
        set({ error: (err as Error).message })
      }
    }
  },

  updateWatchlistPrefs: async (seriesId, prefs) => {
    try {
      const { error } = await supabase
        .from('release_watchlist')
        .update(prefs)
        .eq('series_id', seriesId)
      if (error) throw error
      set(state => ({
        watchlist: state.watchlist.map(w =>
          w.series_id === seriesId ? { ...w, ...prefs } : w
        ),
      }))
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  subscribeRealtime: () => {
    if (!isSupabaseConfigured) return () => {}

    const channel = supabase
      .channel('notifications-insert')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as AppNotification
          set(state => ({
            notifications: [newNotif, ...state.notifications].sort((a, b) => {
              if (!a.release_date) return 1
              if (!b.release_date) return -1
              return a.release_date.localeCompare(b.release_date)
            }),
            unreadCount: state.unreadCount + 1,
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },
}))
