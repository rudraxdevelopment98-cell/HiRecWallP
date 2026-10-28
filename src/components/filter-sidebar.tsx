import Link from 'next/link';
import type { Category, ExploreFilters } from '@/types/catalogue';

const RESOLUTIONS = ['4K', '5K', '8K'];
const DEVICES = ['Mobile', 'Desktop', 'Tablet', 'Ultrawide'];
const ASPECTS = ['16:9', '9:16', '21:9', '1:1'];
const ORIENTATIONS = ['Landscape', 'Portrait'];

/**
 * Explore/category filter sidebar. Categories + free/paid drive the catalogue
 * query; resolution/aspect/orientation submit too (persisted in the URL) and
 * are honoured once those fields exist on wallpapers.
 */
export function FilterSidebar({
  categories,
  filters,
}: {
  categories: Category[];
  filters: ExploreFilters;
}) {
  return (
    <form action="/explore" method="get" className="space-y-6 text-sm">
      <div className="relative">
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Search wallpapers…"
          className="w-full rounded-full border bg-card px-4 py-2 text-sm outline-none focus:border-ring"
        />
      </div>

      <Group title="Categories">
        <Radio name="category" value="" label="All" checked={!filters.category} />
        {categories.map((c) => (
          <Radio key={c.id} name="category" value={c.slug} label={c.name} checked={filters.category === c.slug} />
        ))}
      </Group>

      <Group title="Price">
        <Radio name="free" value="" label="All" checked={filters.free === undefined} />
        <Radio name="free" value="1" label="Free" checked={filters.free === true} />
        <Radio name="free" value="0" label="Premium" checked={filters.free === false} />
      </Group>

      <Group title="Resolution">
        {RESOLUTIONS.map((r) => (
          <Check key={r} name="res" value={r} label={r} />
        ))}
      </Group>

      <Group title="Device">
        {DEVICES.map((d) => (
          <Check key={d} name="device" value={d} label={d} />
        ))}
      </Group>

      <Group title="Aspect Ratio">
        {ASPECTS.map((a) => (
          <Check key={a} name="aspect" value={a} label={a} />
        ))}
      </Group>

      <Group title="Orientation">
        {ORIENTATIONS.map((o) => (
          <Check key={o} name="orientation" value={o} label={o} />
        ))}
      </Group>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          Apply Filters
        </button>
        <Link href="/explore" className="text-muted-foreground hover:text-foreground">
          Reset
        </Link>
      </div>
    </form>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-semibold">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Radio({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
      <input type="radio" name={name} value={value} defaultChecked={checked} className="accent-primary" />
      <span className={checked ? 'text-foreground' : ''}>{label}</span>
    </label>
  );
}

function Check({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
      <input type="checkbox" name={name} value={value} className="accent-primary" />
      {label}
    </label>
  );
}
