import { NavLink, Outlet } from 'react-router-dom'
import SetupBanner from './SetupBanner'
import ScrollToTop from './ScrollToTop'
import {
  LayoutDashboard,
  Library,
  Search,
  Upload,
  Star,
  BookOpen,
  Settings,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/collection', label: 'My Collection', icon: Library },
  { to: '/browse', label: 'Browse', icon: Search },
  { to: '/import', label: 'Import CSV', icon: Upload },
  { to: '/rankings', label: 'Rankings', icon: Star },
  { to: '/progress', label: 'Progress', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <ScrollToTop />
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 bg-ink-900 border-r border-ink-800 flex flex-col fixed top-0 left-0 h-full z-40">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center lg:justify-start px-4 border-b border-ink-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-sm">M</span>
            </div>
            <span className="hidden lg:block text-white font-bold text-lg tracking-tight">Manga<span className="text-accent-500">Lib</span></span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group ${
                  isActive
                    ? 'bg-accent-600/20 text-accent-400 border border-accent-600/30'
                    : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-ink-800 hidden lg:block">
          <p className="text-ink-600 text-xs">Manga Library v0.1</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-16 lg:ml-56 min-h-screen flex flex-col">
        <SetupBanner />
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
