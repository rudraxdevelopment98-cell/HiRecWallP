import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { Badge } from '@/components/ui/badge';
import { RunJobButton } from '@/components/admin/run-job-button';

interface Prompt {
  id: string;
  niche: string;
  festival: string | null;
  prompt: string;
  aspect: string;
  active: boolean;
}

async function listPrompts(): Promise<Prompt[] | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('prompt_library')
      .select('id, niche, festival, prompt, aspect, active')
      .order('created_at', { ascending: false })
      .limit(100);
    return (data as Prompt[]) ?? [];
  } catch {
    return null;
  }
}

export default async function PromptsPage() {
  const prompts = await listPrompts();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Prompt library</h1>
          <p className="text-sm text-muted-foreground">
            No trademarked characters, brand logos, real people or NSFW — enforced in generation.
          </p>
        </div>
        <RunJobButton label="Generate from all active" endpoint="/api/jobs/generate-batch" body={{ promptLimit: 5 }} />
      </div>

      {prompts == null ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">Connect Supabase to manage prompts.</p>
      ) : prompts.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">No prompts yet. Seed adds a few samples.</p>
      ) : (
        <ul className="space-y-3">
          {prompts.map((p) => (
            <li key={p.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap gap-2">
                  <Badge variant="outline">{p.niche}</Badge>
                  {p.festival && <Badge variant="secondary">{p.festival}</Badge>}
                  <Badge variant="secondary">{p.aspect}</Badge>
                  {!p.active && <Badge variant="outline">inactive</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{p.prompt}</p>
              </div>
              <RunJobButton
                label="Generate"
                variant="outline"
                endpoint="/api/jobs/generate-batch"
                body={{ promptId: p.id, count: 3 }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
