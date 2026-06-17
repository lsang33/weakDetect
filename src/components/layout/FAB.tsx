import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'

interface FABProps {
  className?: string
}

export function FAB({ className }: FABProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/log')}
      className={cn(
        'fixed right-5 bottom-20 z-40 w-14 h-14 rounded-2xl',
        'bg-blue-500 hover:bg-blue-600 active:scale-95',
        'text-white shadow-lg shadow-blue-500/30',
        'flex items-center justify-center',
        'transition-all duration-200',
        className
      )}
      aria-label="记录错题"
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  )
}
