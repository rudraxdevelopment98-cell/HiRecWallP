import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { Badge } from '@/components/ui/badge';
import { RunJobButton } from '@/components/admin/run-job-button';

interface Post {
  id: string;
  platform: string;
  format: string;
  caption: string | null;
  scheduled_for: string | null;
  status: string;
  external_id: string | null;
  wallpapers: { slug: string; title: string } | null;
}

async function listPosts(): Promise<Post[] | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('social_posts')
      .select('id, platform, format, caption, scheduled_for, status, external_id, wallpapers(slug, title)')
      .order('scheduled_for', { ascending: true })
      .limit(60)
      .returns<Post[]>();
    return data ?? [];
  } catch {
    return null;
  }
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'free' {
  if (status === 'posted') return 'free';
  if (status === 'failed') return 'outline';
  return 'secondary';
}

export default async function AdminSocialPage() {
  const posts = await listPosts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Social calendar</h1>
          <p className="text-sm text-muted-foreground">
            Drafts are created automatically on publish. Scheduler runs every 30 min (IG ≤3/day,
            Pinterest ≤10/day).
          </p>
        </div>
        <RunJobButton label="Run scheduler now" endpoint="/api/jobs/social-scheduler" />
      </div>

      {posts == null ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">Connect Supabase to see the calendar.</p>
      ) : posts.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          No posts yet. Approve a wallpaper to auto-create Instagram + Pinterest drafts.
        </p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => (
            <li key={p.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-4">
              <Badge variant="outline">{p.platform}</Badge>
              <Badge variant="secondary">{p.format}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">
                {p.wallpapers?.title ?? 'Wallpaper'} — {p.caption}
              </span>
              <span className="text-xs text-muted-foreground">
                {p.scheduled_for ? new Date(p.scheduled_for).toLocaleString() : '—'}
              </span>
              <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
