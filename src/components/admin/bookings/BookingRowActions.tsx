import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, CheckCheck, MoreHorizontal, UserX, Banknote, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import type { BookingState } from './bookingState';

interface BookingRowActionsProps {
  state: BookingState;
  isBusy: boolean;
  onConfirm: () => void;
  onComplete: () => void;
  onNoShow: () => void;
  onResolveFee: () => void;
  onAddFee: () => void;
  onCancel: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

const PRIMARY = 'inline-flex items-center gap-1.5 rounded-lg bg-[#1A1714] px-3 py-1.5 text-xs font-medium text-white shadow-[0_2px_10px_rgba(26,23,20,0.14)] transition hover:bg-[#2E2926] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 disabled:opacity-50';
const SECONDARY = 'inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20 disabled:opacity-50';
const MENU_ITEM = 'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-stone-700 outline-none data-[highlighted]:bg-stone-100 data-[highlighted]:text-[#1A1714]';

export default function BookingRowActions(props: BookingRowActionsProps) {
  const { state, isBusy } = props;
  const isClosed = state.stage === 'cancelled' || state.stage === 'completed' || state.stage === 'no-show';

  return (
    <div className="flex items-center justify-end gap-1.5">
      {state.primary === 'confirm' && (
        <button type="button" onClick={props.onConfirm} disabled={isBusy} className={PRIMARY}>
          <Check className="h-3.5 w-3.5" /> Confirm
        </button>
      )}
      {state.primary === 'complete' && (
        <button type="button" onClick={props.onComplete} disabled={isBusy} className={PRIMARY}>
          <CheckCheck className="h-3.5 w-3.5" /> Showed up
        </button>
      )}
      {state.canMarkNoShow && (
        <button type="button" onClick={props.onNoShow} disabled={isBusy} className={SECONDARY}>
          <UserX className="h-3.5 w-3.5" /> No-show
        </button>
      )}
      {state.primary === 'add-fee' && (
        <button type="button" onClick={props.onAddFee} disabled={isBusy} className={PRIMARY}>
          <Banknote className="h-3.5 w-3.5" /> Add fee
        </button>
      )}
      {state.primary === 'resolve-fee' && (
        <button type="button" onClick={props.onResolveFee} disabled={isBusy} className={PRIMARY}>
          <Banknote className="h-3.5 w-3.5" /> Resolve fee
        </button>
      )}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          disabled={isBusy}
          aria-label="More actions"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/20 data-[state=open]:bg-stone-100 data-[state=open]:text-stone-700"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-[200px] rounded-xl border border-stone-200/80 bg-white p-1 shadow-[0_12px_40px_rgba(26,23,20,0.14)]"
          >
            {!isClosed && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={props.onCancel}>
                <XCircle className="h-4 w-4 text-stone-400" /> Cancel booking
              </DropdownMenu.Item>
            )}
            {state.stage === 'cancelled' && (
              <DropdownMenu.Item className={MENU_ITEM} onSelect={props.onRestore}>
                <RotateCcw className="h-4 w-4 text-stone-400" /> Reopen as confirmed
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-stone-100" />
            <DropdownMenu.Item
              className={`${MENU_ITEM} text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700`}
              onSelect={props.onDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete permanently
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
