import type { LucideIcon } from 'lucide-react';
import { Menu } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface MobileTabBarProps {
  items: TabItem[];
  currentView: string;
  moreLabel: string;
  label: string;
  onSelect: (id: string) => void;
  onMore: () => void;
}

/** Phones: the four daily places one tap away, everything else under "More" (the menu). */
export default function MobileTabBar({ items, currentView, moreLabel, label, onSelect, onMore }: MobileTabBarProps) {
  const isOther = !items.some((item) => item.id === currentView);
  const tab = (isActive: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
      isActive ? 'text-[#1A1714]' : 'text-stone-400 active:bg-stone-900/[0.05]'
    }`;
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-stone-200/80 bg-white/90 px-2 pt-1.5 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = currentView === id;
        return (
          <button key={id} type="button" onClick={() => onSelect(id)} aria-current={isActive ? 'page' : undefined} className={tab(isActive)}>
            <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-[#1A1714] text-white' : ''}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="max-w-full truncate">{label}</span>
          </button>
        );
      })}
      <button type="button" onClick={onMore} className={tab(isOther)}>
        <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${isOther ? 'bg-[#1A1714] text-white' : ''}`}>
          <Menu className="h-[18px] w-[18px]" />
        </span>
        <span>{moreLabel}</span>
      </button>
    </nav>
  );
}
