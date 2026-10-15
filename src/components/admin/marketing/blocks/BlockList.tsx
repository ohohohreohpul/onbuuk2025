import { useState } from 'react';
import { ArrowDown, ArrowUp, Gift, Heading, Image, LayoutTemplate, Minus, MousePointerClick, Plus, Tag, Trash2, Type } from 'lucide-react';
import { useAdminText } from '../../../../lib/adminLanguage';
import type { MarketingBlock, MarketingBlockType } from '../../../../../supabase/functions/_shared/marketingEmail';
import { ADMIN_SECONDARY_BUTTON, ADMIN_SURFACE } from '../../adminUi';
import BlockForm from './BlockForm';
import { BLOCK_TEXT } from './blockText';

const MAX_BLOCKS = 30;

const BLOCK_ICONS: Record<MarketingBlockType, typeof Type> = {
  hero: LayoutTemplate, heading: Heading, text: Type, image: Image, button: MousePointerClick, offer: Tag, vouchers: Gift, divider: Minus,
};

const BLOCK_ORDER: MarketingBlockType[] = ['hero', 'heading', 'text', 'image', 'button', 'offer', 'vouchers', 'divider'];

function newBlock(type: MarketingBlockType): MarketingBlock {
  switch (type) {
    case 'hero': return { type, headline: '', logoUrl: null, imageUrl: null, buttonText: '', buttonUrl: '', caption: '' };
    case 'heading': return { type, text: '' };
    case 'text': return { type, text: '' };
    case 'image': return { type, url: '', size: 'medium', link: null };
    case 'button': return { type, text: '', url: '', style: 'dark' };
    case 'offer': return { type, title: '', text: '', imageUrl: null, priceCents: null, compareCents: null, buttonText: '', buttonUrl: '' };
    case 'vouchers': return { type, title: '', showImages: false };
    case 'divider': return { type };
  }
}

interface BlockListProps {
  blocks: MarketingBlock[];
  businessId: string;
  onChange: (blocks: MarketingBlock[]) => void;
}

/** The email as a list of blocks: edit, reorder, remove, add. */
export default function BlockList({ blocks, businessId, onChange }: BlockListProps) {
  const { t } = useAdminText(BLOCK_TEXT);
  const [adding, setAdding] = useState(false);

  const replace = (index: number, block: MarketingBlock) => onChange(blocks.map((current, i) => (i === index ? block : current)));
  const remove = (index: number) => onChange(blocks.filter((_, i) => i !== index));
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const add = (type: MarketingBlockType) => {
    onChange([...blocks, newBlock(type)]);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const Icon = BLOCK_ICONS[block.type];
        return (
          // Blocks have no ids; the index is stable because only explicit moves reorder them.
          <section key={index} className={`${ADMIN_SURFACE} p-4`} aria-label={t[block.type]}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-[#1A1714]"><Icon className="h-4 w-4 text-stone-400" aria-hidden="true" />{t[block.type]}</span>
              <span className="flex items-center gap-0.5">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t.moveUp} title={t.moveUp} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-900/[0.05] hover:text-stone-700 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === blocks.length - 1} aria-label={t.moveDown} title={t.moveDown} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-900/[0.05] hover:text-stone-700 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(index)} aria-label={t.remove} title={t.remove} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
              </span>
            </div>
            {block.type !== 'divider' && <BlockForm block={block} businessId={businessId} onChange={(next) => replace(index, next)} />}
          </section>
        );
      })}

      {adding ? (
        <div className={`${ADMIN_SURFACE} grid grid-cols-2 gap-2 p-3 sm:grid-cols-4`}>
          {BLOCK_ORDER.map((type) => {
            const Icon = BLOCK_ICONS[type];
            return (
              <button key={type} type="button" onClick={() => add(type)} className="rounded-xl bg-white/80 p-3 text-left ring-1 ring-stone-200/80 transition hover:ring-stone-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40">
                <Icon className="mb-1.5 h-4 w-4 text-stone-500" aria-hidden="true" />
                <span className="block text-sm font-medium text-[#1A1714]">{t[type]}</span>
                <span className="block text-[11px] leading-snug text-stone-500">{t[`${type}Hint` as const]}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} disabled={blocks.length >= MAX_BLOCKS} className={`${ADMIN_SECONDARY_BUTTON} w-full`}>
          <Plus className="h-4 w-4" /> {t.addBlock}
        </button>
      )}
    </div>
  );
}
