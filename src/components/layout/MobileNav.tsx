import { useEffect, useState } from 'react';
import { Activity, Clock, Home, Settings } from 'lucide-react';
import type { AppView } from './TopBar';

interface MobileNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

const ITEMS: Array<{ id: AppView; label: string; Icon: typeof Home }> = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'activity', label: 'Activity', Icon: Activity },
  { id: 'history', label: 'History', Icon: Clock },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function MobileNav({ activeView, onNavigate }: MobileNavProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setKeyboardOpen(true);
      }
    };
    const onFocusOut = () => {
      setTimeout(() => {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          setKeyboardOpen(false);
        }
      }, 80);
    };

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  if (keyboardOpen) return null;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-3 left-4 right-4 z-30 md:hidden pb-safe"
    >
      <div className="eon-panel mx-auto grid h-14 max-w-md grid-cols-4 items-center rounded-2xl backdrop-blur-xl px-1">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                isActive ? 'text-[#9BB4FF]' : 'text-[#7C8599] hover:text-[#F3F5FA]'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
