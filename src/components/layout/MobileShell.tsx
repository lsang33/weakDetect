import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { PageHeader } from './PageHeader'
import { FAB } from './FAB'
import { useMemo } from 'react'

const pageConfig: Record<string, { title: string; subtitle?: string; showFAB: boolean; showSettings?: boolean }> = {
  '/': { title: '备考概览', showFAB: true, showSettings: true },
  '/log': { title: '记录错题', subtitle: '认真分析每一次错误', showFAB: false },
  '/mistakes': { title: '错题本', showFAB: true },
  '/analytics': { title: '统计分析', showFAB: false },
  '/review': { title: '复习计划', showFAB: false },
  '/settings': { title: '设置', showFAB: false },
}

export function MobileShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const config = useMemo(() => {
    if (location.pathname.startsWith('/mistakes/') && location.pathname !== '/mistakes') {
      return { title: '错题详情', showFAB: false, showSettings: false }
    }
    return pageConfig[location.pathname] || { title: '错题分析', showFAB: false, showSettings: false }
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={config.showSettings ? (
          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <Settings size={20} />
          </button>
        ) : undefined}
      />
      <main className="pb-24 pt-1 max-w-lg mx-auto px-4">
        <Outlet />
      </main>
      {config.showFAB && <FAB />}
      <BottomNav />
    </div>
  )
}
