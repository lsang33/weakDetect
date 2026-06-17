import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, BarChart3, CalendarCheck } from 'lucide-react'
import { cn } from '../../lib/cn'

const tabs = [
  { to: '/', icon: LayoutDashboard, label: '首页' },
  { to: '/mistakes', icon: BookOpen, label: '错题本' },
  { to: '/analytics', icon: BarChart3, label: '分析' },
  { to: '/review', icon: CalendarCheck, label: '复习' },
]

export function BottomNav() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors',
                isActive ? 'text-blue-500' : 'text-slate-400'
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
