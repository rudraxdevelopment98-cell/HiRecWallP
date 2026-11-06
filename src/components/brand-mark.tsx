import { cn } from '@/lib/utils';

/**
 * HirecWallp mark: twin peaks with a rising sun (line style). Inherits the text
 * colour, so it works on light and dark backgrounds. Source artwork and 4K
 * exports live in public/brand/.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M2.5 19.5 L9 8 L13.6 15.6" />
      <path d="M11.7 12.5 L15 7 L21.5 19.5" />
      <path d="M2.5 19.5 H21.5" />
      <circle cx="19.2" cy="4.6" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
