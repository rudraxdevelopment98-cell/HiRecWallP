import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="container flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-6xl font-semibold">404</p>
      <h1 className="text-xl font-semibold">This page wandered off</h1>
      <p className="text-sm text-muted-foreground">
        The link may be old, or the wallpaper is no longer available.
      </p>
      <div className="flex gap-3">
        <Link href="/explore" className={buttonVariants()}>
          Explore wallpapers
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Home
        </Link>
      </div>
    </main>
  );
}
