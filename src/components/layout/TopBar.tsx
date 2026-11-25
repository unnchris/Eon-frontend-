import { motion } from 'motion/react';
import { Plus, User } from 'lucide-react';
import type { EonUser } from '../../types/eon';

export type AppView = 'home' | 'activity' | 'history' | 'settings';

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onNewTask: () => void;
  hasActiveTask: boolean;
  user: EonUser | null;
  onOpenAuth: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'activity', label: 'Activity' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export function TopBar({
  activeView,
  onNavigate,
  onNewTask,
  hasActiveTask,
  user,
  onOpenAuth,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-[#050608]/95 via-[#050608]/80 to-transparent backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-display text-sm font-semibold tracking-[0.26em] text-[#F3F5FA] whitespace-nowrap shrink-0 hover:text-white transition-colors"
        >
          EON
        </button>

        {/* Zone 2: Clean consumer navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1.5 text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'text-[#F3F5FA]'
                    : 'text-[#7C8599] hover:text-[#E2E6F0]'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="eon-nav-dot"
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                    className="absolute inset-x-1 -bottom-0.5 h-[1.5px] rounded-full bg-[#5B7CFA]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account + New task */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              aria-label={`Account: ${user.display_name}`}
              title={user.display_name}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#D2D8E6] whitespace-nowrap shrink-0 hover:bg-white/[0.08] transition-colors"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5B7CFA]/25 text-[11px] font-semibold text-[#9BB4FF]">
                {user.display_name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline max-w-[110px] truncate">{user.display_name}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-[#D2D8E6] whitespace-nowrap shrink-0 hover:bg-white/[0.08] transition-colors"
            >
              <User className="h-3.5 w-3.5 text-[#9BB4FF]" aria-hidden="true" />
              <span>Sign in</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewTask}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-[#F3F5FA] whitespace-nowrap shrink-0 hover:bg-white/[0.10] active:scale-[0.98] transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-[#9BB4FF]" aria-hidden="true" />
            <span>{hasActiveTask ? 'New' : 'New Task'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
