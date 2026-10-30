import { requireAdmin } from '@/lib/auth';
import Image from 'next/image';
import { createServiceClient } from '@/lib/supabase/service';
import { publicEnv } from '@/lib/env';
import { Badge } from '@/components/ui/badge';
import { GenerationActions } from '@/components/admin/generation-actions';
import { RunJobButton } from '@/components/admin/run-job-button';

interface Candidate {
  idx: number;
  score: number;
  publicUrl: string | null;
  best?: boolean;
  dropped?: string;
}
interface Meta {
  title?: string;
  tags?: string[];
  description?: string;
  suggestedFree?: boolean;
  category?: string;
}
interface Job {
  id: string;
  status: string;
  candidates: Candidate[];
  metadata: Meta | null;
  created_at: string;
}

async function listQueue(): Promise<Job[] | null> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('generation_jobs')
      .select('id, status, candidates, metadata, created_at')
      .eq('status', 'awaiting_review')
      .order('created_at', { ascending: false })
      .limit(30);
    return (data as Job[]) ?? [];
  } catch {
    return null;
  }
}

export default async function ReviewQueuePage() {
  await requireAdmin();
  const jobs = await listQueue();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Review queue</h1>
          <p className="text-sm text-muted-foreground">
            Human quality gate. Approve to publish + schedule social, or reject.
          </p>
        </div>
        <RunJobButton label="Generate batch" endpoint="/api/jobs/generate-batch" body={{ promptLimit: 2 }} />
      </div>

      {jobs == null ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          Connect Supabase + R2 to run the generation pipeline.
        </p>
      ) : jobs.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">
          Nothing awaiting review. Hit “Generate batch” to create candidates.
        </p>
      ) : (
        <div className="space-y-6">
          {jobs.map((job) => (
            <div key={job.id} className="glass rounded-2xl p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{job.metadata?.title ?? 'Untitled'}</h2>
                {job.metadata?.suggestedFree && <Badge variant="free">suggested FREE</Badge>}
                {job.metadata?.category && <Badge variant="outline">{job.metadata.category}</Badge>}
              </div>
              {job.metadata?.description && (
                <p className="mb-3 text-sm text-muted-foreground">{job.metadata.description}</p>
              )}
              {job.metadata?.tags && job.metadata.tags.length > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {job.metadata.tags.map((t) => `#${t}`).join(' ')}
                </p>
              )}
              <div className="mb-4 flex flex-wrap gap-3">
                {job.candidates.map((c) => (
                  <div
                    key={c.idx}
                    className={`relative h-40 w-28 overflow-hidden rounded-lg border ${
                      c.best ? 'border-foreground/60 ring-2 ring-[hsl(var(--glow)/0.5)]' : 'border'
                    } ${c.dropped ? 'opacity-40' : ''}`}
                  >
                    {c.publicUrl ? (
                      <Image src={c.publicUrl} alt="" fill sizes="112px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        no preview
                      </div>
                    )}
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      {c.dropped ? c.dropped : `★ ${c.score}`}
                    </span>
                  </div>
                ))}
              </div>
              <GenerationActions jobId={job.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
