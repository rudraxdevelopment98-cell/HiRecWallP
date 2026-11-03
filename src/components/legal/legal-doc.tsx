import Link from 'next/link';
import { POLICIES, type PolicyKey } from '@/lib/policies';

export interface LegalSection {
  id: string;
  heading: string;
  body: React.ReactNode;
}

/**
 * Shared layout for policy pages: title, version + effective date, contents,
 * numbered sections and links to the other policies.
 */
export function LegalDoc({ policy, intro, sections }: { policy: PolicyKey; intro: React.ReactNode; sections: LegalSection[] }) {
  const p = POLICIES[policy];
  return (
    <main className="container grid max-w-5xl gap-10 py-10 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav aria-label="Contents" className="sticky top-24 space-y-1 text-sm">
          <p className="mb-2 font-semibold">Contents</p>
          {sections.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
              {i + 1}. {s.heading}
            </a>
          ))}
        </nav>
      </aside>
      <article className="min-w-0 space-y-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{p.title}</h1>
          <p className="text-sm text-muted-foreground">
            Effective {p.effective} · version {p.version}
          </p>
          <div className="space-y-3 text-sm leading-7 text-muted-foreground">{intro}</div>
        </header>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 space-y-3">
            <h2 className="text-lg font-semibold">
              {i + 1}. {s.heading}
            </h2>
            <div className="space-y-3 text-sm leading-7 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">{s.body}</div>
          </section>
        ))}
        <footer className="border-t pt-6 text-xs text-muted-foreground">
          <p>
            Other policies:{' '}
            {(Object.keys(POLICIES) as PolicyKey[])
              .filter((k) => k !== policy)
              .map((k, i) => (
                <span key={k}>
                  {i > 0 && ' · '}
                  <Link href={POLICIES[k].href} className="underline">
                    {POLICIES[k].title}
                  </Link>
                </span>
              ))}
          </p>
          <p className="mt-2">Written to match how this site actually works and current Indian rules for online sellers. Not reviewed by a lawyer.</p>
        </footer>
      </article>
    </main>
  );
}
