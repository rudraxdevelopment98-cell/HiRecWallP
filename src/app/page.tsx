const brand = process.env.BRAND_NAME ?? 'HirecWallp';

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-24 text-center">
      <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
        Phase 1 · MVP in progress
      </span>
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
        Ultra-HD wallpapers,
        <br className="hidden sm:block" /> made for your screen
      </h1>
      <p className="max-w-xl text-balance text-muted-foreground">
        {brand} — AI-generated wallpapers for phone, desktop and tablet. Free picks,
        cheap premium downloads, priced for your country.
      </p>
    </main>
  );
}
