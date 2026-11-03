import { Skeleton } from '@/components/ui/skeleton';

export default function AccountLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
