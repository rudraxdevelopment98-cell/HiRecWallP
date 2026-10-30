'use client';

import { Heart } from 'lucide-react';
import { toggleFavourite, useFavourite } from '@/lib/favourites-client';
import { cn } from '@/lib/utils';

/** Heart toggle. Safe inside a card link: it doesn't trigger navigation. */
export function FavouriteButton({ id, className, withLabel }: { id: string; className?: string; withLabel?: boolean }) {
  const on = useFavourite(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Remove from favourites' : 'Save to favourites'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleFavourite(id);
      }}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 transition-colors',
        withLabel
          ? 'rounded-full border px-4 py-2.5 text-sm font-medium hover:bg-secondary'
          : 'h-8 w-8 rounded-full bg-white/90 shadow-sm backdrop-blur hover:bg-white',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', on ? 'fill-rose-500 text-rose-500' : 'text-foreground')} />
      {withLabel && (on ? 'Saved' : 'Save')}
    </button>
  );
}
