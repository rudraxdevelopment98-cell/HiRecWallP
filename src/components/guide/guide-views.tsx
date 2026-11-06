import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { GUIDE_GROUPS, stepAnchor, type GuideAudience, type GuideChapter, type GuideStep } from '@/lib/guide';

/** A screenshot with the step's highlight ring drawn over it (positions are fractions, so it scales). */
export function GuideFigure({ step, n }: { step: GuideStep; n: number }) {
  if (!step.image) return null;
  const b = step.box;
  return (
    <figure className="relative overflow-hidden rounded-xl border bg-secondary shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- static guide screenshot */}
      <img src={step.image} alt={`Step ${n}: ${step.title}`} width={step.width} height={step.height} loading="lazy" className="block h-auto w-full" />
      {b && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-lg ring-[3px] ring-accent shadow-[0_0_0_9999px_rgba(15,23,42,0.18)]"
            style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-xs font-semibold text-white shadow"
            style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}
          >
            {n}
          </span>
        </>
      )}
    </figure>
  );
}

export function GuideIndex({ chapters, base, audiences }: { chapters: GuideChapter[]; base: string; audiences: GuideAudience[] }) {
  return (
    <div className="space-y-10">
      {audiences.map((a) => {
        const list = chapters.filter((c) => c.audience === a);
        if (!list.length) return null;
        return (
          <section key={a} className="space-y-4">
            <h2 className="font-display text-lg font-semibold">{GUIDE_GROUPS[a]}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => {
                const cover = c.steps.find((s) => s.image);
                return (
                  <li key={c.slug}>
                    <Link href={`${base}/${c.slug}`} className="group block h-full overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
                      <div className="aspect-[16/9] overflow-hidden border-b bg-secondary">
                        {cover?.image && (
                          // eslint-disable-next-line @next/next/no-img-element -- static guide screenshot
                          <img src={cover.image} alt="" loading="lazy" className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]" />
                        )}
                      </div>
                      <div className="space-y-1 p-4">
                        <p className="font-medium">{c.title}</p>
                        <p className="text-sm text-muted-foreground">{c.summary}</p>
                        <p className="pt-1 text-xs text-muted-foreground">{c.steps.length} steps</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function GuideChapterView({
  chapter,
  base,
  prev,
  next,
}: {
  chapter: GuideChapter;
  base: string;
  prev: GuideChapter | null;
  next: GuideChapter | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Steps" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <p className="mb-2 text-sm font-semibold">In this guide</p>
        <ol className="space-y-1 text-sm text-muted-foreground">
          {chapter.steps.map((s, i) => (
            <li key={i}>
              <a href={`#${stepAnchor(i)}`} className="flex gap-2 rounded-lg px-3 py-1.5 hover:bg-secondary hover:text-foreground">
                <span className="tabular-nums">{i + 1}.</span>
                <span>{s.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="min-w-0 space-y-12">
        {chapter.steps.map((s, i) => (
          <section key={i} id={stepAnchor(i)} className="scroll-mt-24 space-y-3">
            <h2 className="flex items-baseline gap-3 font-display text-xl font-semibold">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-xs text-background">{i + 1}</span>
              {s.title}
            </h2>
            <p className="max-w-3xl text-muted-foreground">{s.body}</p>
            {s.href && (
              <p className="text-sm">
                <Link href={s.href} className="underline">
                  Open this page
                </Link>
              </p>
            )}
            <GuideFigure step={s} n={i + 1} />
          </section>
        ))}
        <div className="flex flex-wrap justify-between gap-3 border-t pt-6 text-sm">
          {prev ? (
            <Link href={`${base}/${prev.slug}`} className="inline-flex items-center gap-1.5 hover:underline">
              <ArrowLeft className="h-4 w-4" /> {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`${base}/${next.slug}`} className="inline-flex items-center gap-1.5 hover:underline">
              {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
