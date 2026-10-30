import Link from 'next/link';
import type { Category, ExploreFilters } from '@/types/catalogue';

const DEVICES = ['Mobile', 'Tablet', 'Desktop', 'Ultrawide'];

/**
 * Explore/category filter sidebar. Every option maps to real wallpaper data:
 * device = which sizes exist, orientation = artwork shape, resolution = the
 * largest size we deliver.
 */
export function FilterSidebar({
  categories,
  filters,
  action = '/explore',
}: {
  categories: Category[];
  filters: ExploreFilters;
  action?: string;
}) {
  return (
    <form action={action} method="get" className="space-y-6 text-sm">
      <div className="relative">
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Search wallpapers…"
          aria-label="Search wallpapers"
          className="w-full rounded-full border bg-card px-4 py-2 text-sm outline-none focus:border-ring"
        />
      </div>

      <Group title="Sort by">
        <select name="sort" defaultValue={filters.sort ?? 'newest'} className="input" aria-label="Sort by">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Name (A–Z)</option>
        </select>
      </Group>

      {action === '/explore' && (
        <Group title="Categories">
          <Radio name="category" value="" label="All" checked={!filters.category} />
          {categories.map((c) => (
            <Radio key={c.id} name="category" value={c.slug} label={c.name} checked={filters.category === c.slug} />
          ))}
        </Group>
      )}

      <Group title="Price">
        <Radio name="free" value="" label="All" checked={filters.free === undefined} />
        <Radio name="free" value="1" label="Free" checked={filters.free === true} />
        <Radio name="free" value="0" label="Premium" checked={filters.free === false} />
      </Group>

      <Group title="Device">
        {DEVICES.map((d) => (
          <Check key={d} name="device" value={d} label={d} checked={filters.devices?.includes(d) ?? false} />
        ))}
      </Group>

      <Group title="Orientation">
        <Radio name="orientation" value="" label="Any" checked={!filters.orientation} />
        <Radio name="orientation" value="portrait" label="Portrait (phone)" checked={filters.orientation === 'portrait'} />
        <Radio name="orientation" value="landscape" label="Landscape (desktop)" checked={filters.orientation === 'landscape'} />
      </Group>

      <Group title="Resolution">
        <Radio name="res" value="" label="Any" checked={!filters.resolution} />
        <Radio name="res" value="4K" label="4K or higher" checked={filters.resolution === '4K'} />
        <Radio name="res" value="5K" label="5K" checked={filters.resolution === '5K'} />
      </Group>

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          Apply Filters
        </button>
        <Link href={action} className="text-muted-foreground hover:text-foreground">
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

function Check({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="accent-primary" />
      <span className={checked ? 'text-foreground' : ''}>{label}</span>
    </label>
  );
}
