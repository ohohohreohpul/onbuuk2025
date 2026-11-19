/** "Anna Müller" → "AM", "A. Müller" → "AM", "Lisa" → "L". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s.]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** Round initials badge; fixed size so it never squashes next to long names. */
export default function CustomerAvatar({ name, isBlocked = false }: { name: string; isBlocked?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tracking-wide ${
        isBlocked ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-[#1A1714] text-white'
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}
