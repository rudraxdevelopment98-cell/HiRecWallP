import { createServiceClient } from '@/lib/supabase/service';
import { AdminForm, type FieldDef } from '@/components/admin/admin-form';

export const dynamic = 'force-dynamic';

const CATEGORY_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name' },
  { name: 'slug', label: 'URL slug', hint: '/collections/<slug>' },
  { name: 'sort_order', label: 'Order', type: 'number' },
];
const SET_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Title' },
  { name: 'slug', label: 'URL slug', hint: '/sets/<slug>' },
  { name: 'description', label: 'Description', type: 'textarea' },
];

export default async function AdminCategoriesPage() {
  const supabase = createServiceClient();
  const [{ data: categories }, { data: sets }, { data: rows }] = await Promise.all([
    supabase.from('categories').select('id, name, slug, sort_order').order('sort_order'),
    supabase.from('wallpaper_sets').select('id, title, slug, description').order('title'),
    supabase.from('wallpapers').select('category_id, set_id'),
  ]);
  const count = (key: 'category_id' | 'set_id', id: string) => (rows ?? []).filter((r) => r[key] === id).length;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted-foreground">Shown on the home page, Explore filters and Collections. Deleting one leaves its wallpapers uncategorised.</p>
        </div>
        {(categories ?? []).map((c) => (
          <div key={c.id as string} className="rounded-2xl border bg-card p-4">
            <p className="mb-2 text-xs text-muted-foreground">{count('category_id', c.id as string)} wallpaper(s)</p>
            <AdminForm compact action={`/api/admin/categories/${c.id}`} deleteAction={`/api/admin/categories/${c.id}`} fields={CATEGORY_FIELDS} initial={c} />
          </div>
        ))}
        <details className="rounded-2xl border border-dashed bg-card p-4">
          <summary className="cursor-pointer font-medium">+ Add a category</summary>
          <div className="mt-3">
            <AdminForm action="/api/admin/categories" method="POST" submitLabel="Create category" resetOnSuccess fields={CATEGORY_FIELDS} initial={{ sort_order: 100 }} />
          </div>
        </details>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Matching sets</h2>
          <p className="text-sm text-muted-foreground">Groups of wallpapers sold together (assign wallpapers to a set from Catalogue → Edit).</p>
        </div>
        {(sets ?? []).map((s) => (
          <div key={s.id as string} className="rounded-2xl border bg-card p-4">
            <p className="mb-2 text-xs text-muted-foreground">{count('set_id', s.id as string)} wallpaper(s)</p>
            <AdminForm compact action={`/api/admin/sets/${s.id}`} deleteAction={`/api/admin/sets/${s.id}`} fields={SET_FIELDS} initial={s} />
          </div>
        ))}
        <details className="rounded-2xl border border-dashed bg-card p-4">
          <summary className="cursor-pointer font-medium">+ Add a set</summary>
          <div className="mt-3">
            <AdminForm action="/api/admin/sets" method="POST" submitLabel="Create set" resetOnSuccess fields={SET_FIELDS} />
          </div>
        </details>
      </section>
    </div>
  );
}
