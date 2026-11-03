import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Page title row: title, one-line description, optional actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="space-y-2">
      {back && (
        <Link href={back.href} className="text-sm text-muted-foreground hover:text-foreground">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** A card section with an optional header (title, description, actions). */
export function Section({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** No inner padding (tables that run edge to edge). */
  flush?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('admin-card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0 space-y-0.5">
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {description && <p className="text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'overflow-x-auto' : 'p-5'}>{children}</div>
    </section>
  );
}

/** Stack of sections with consistent spacing. */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-6', className)}>{children}</div>;
}

/** Number tile. `tone` colours the hint for attention states. */
export function Stat({
  label,
  value,
  hint,
  href,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  icon?: LucideIcon;
}) {
  const body = (
    <div className={cn('admin-card h-full p-4 transition-colors', href && 'hover:border-foreground/25')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && (
        <p
          className={cn(
            'mt-0.5 text-xs',
            tone === 'good' && 'text-emerald-700',
            tone === 'warn' && 'text-amber-700',
            tone === 'bad' && 'text-rose-700',
            tone === 'default' && 'text-muted-foreground',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', cols === 3 && 'lg:grid-cols-3', cols === 4 && 'lg:grid-cols-4')}>{children}</div>;
}

/** Friendly empty state with an optional action. */
export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      {Icon && <Icon className="h-6 w-6 text-muted-foreground" />}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Pill tabs used for filters (status, period…). */
export function FilterTabs({ items }: { items: { href: string; label: React.ReactNode; active: boolean; count?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm" role="tablist">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          role="tab"
          aria-selected={t.active}
          className={cn(
            'rounded-md px-3 py-1.5 capitalize text-muted-foreground transition-colors hover:text-foreground',
            t.active && 'bg-foreground text-background hover:text-background',
          )}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 tabular-nums opacity-70">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Label/value rows (order and customer details). */
export function DetailList({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="divide-y text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 py-2.5">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
