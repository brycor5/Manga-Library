import { Bell } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'

export default function NotificationBell() {
  const unreadCount = useNotificationStore(s => s.unreadCount)

  return (
    <NavLink
      to="/notifications"
      title="Release notifications"
      className={({ isActive }) =>
        `relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
          isActive
            ? 'bg-accent-600/20 text-accent-400 border border-accent-600/30'
            : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800'
        }`
      }
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </NavLink>
  )
}
