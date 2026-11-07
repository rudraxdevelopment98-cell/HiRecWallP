/**
 * SEO helpers: keyword-aware titles/descriptions and schema.org JSON-LD
 * builders. Pure (no I/O) so they're unit-tested and shared by pages.
 * Render JSON-LD with jsonForScript() (src/lib/safe-json.ts), never bare JSON.stringify.
 */

export interface SeoWallpaper {
  title: string;
  description?: string | null;
  alt_text?: string | null;
  tags?: string[];
  categoryName?: string | null;
  orientation?: 'portrait' | 'landscape' | 'square' | null;
  max_long_edge?: number | null;
  is_free?: boolean;
  previewUrl?: string | null;
  created_at?: string;
}

const resLabel = (edge: number | null | undefined) => (edge && edge >= 5120 ? '5K' : edge && edge >= 3840 ? '4K' : 'HD');

/** "phone" / "desktop" / "phone & desktop" from the artwork's shape (what people search for). */
export function deviceWord(orientation: SeoWallpaper['orientation']): string {
  return orientation === 'portrait' ? 'Phone' : orientation === 'landscape' ? 'Desktop' : 'Phone & Desktop';
}

/**
 * Page title for a wallpaper, e.g. "Liquid Gold 4K Desktop Wallpaper" or
 * "Northern Aurora 4K Phone Wallpaper – Free". The layout template adds the brand.
 */
export function wallpaperTitle(w: SeoWallpaper): string {
  const base = `${w.title} ${resLabel(w.max_long_edge)} ${deviceWord(w.orientation)} Wallpaper`;
  return w.is_free ? `${base} – Free Download` : base;
}

/** Meta description: what it is, sizes, where it fits, free/premium — under ~160 characters where possible. */
export function wallpaperDescription(w: SeoWallpaper): string {
  const res = resLabel(w.max_long_edge);
  const lead = (w.description ?? '').trim().replace(/\s+/g, ' ');
  const what = `${w.title}: ${w.categoryName ? `${w.categoryName.toLowerCase()} ` : ''}wallpaper in ${res}${w.max_long_edge ? ` (up to ${w.max_long_edge}px)` : ''} for ${deviceWord(w.orientation).toLowerCase()}.`;
  const tail = w.is_free ? 'Free download, no sign-up.' : 'Every size included, exact fit for your screen, preview on your device.';
  const text = lead && lead.length < 90 ? `${lead} ${tail}` : `${what} ${tail}`;
  return text.length > 165 ? `${text.slice(0, 162).trimEnd()}…` : text;
}

export function categoryTitle(name: string): string {
  return `${name} Wallpapers 4K – Phone & Desktop`;
}

/** Category intro when the admin hasn't written one: honest, specific, keyword-bearing. */
export function categoryIntro(name: string, count: number): string {
  const n = name.toLowerCase();
  return `Download ${n} wallpapers in ultra-HD 4K and 5K for your phone, tablet and desktop. ${
    count > 0 ? `${count} ${n} wallpaper${count === 1 ? '' : 's'}, ` : ''
  }each with every size included and an exact fit for your own screen — preview any wallpaper on your device before you choose.`;
}

// ---------- JSON-LD ----------

type Ld = Record<string, unknown>;

export function organizationLd(site: string, brand: string, sameAs: string[] = []): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand,
    url: site,
    logo: `${site}/icon.svg`,
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** WebSite + SearchAction → eligible for the sitelinks search box. */
export function websiteLd(site: string, brand: string): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand,
    url: site,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbLd(site: string, items: { name: string; path: string }[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${site}${it.path}` })),
  };
}

/**
 * ImageObject with licence details → eligible for Google Images' "Licensable"
 * badge (license + acquireLicensePage + creator + creditText + copyrightNotice).
 */
export function wallpaperLd(site: string, brand: string, w: SeoWallpaper, path: string): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    name: wallpaperTitle(w),
    description: w.description ?? w.alt_text ?? undefined,
    caption: w.alt_text ?? undefined,
    url: `${site}${path}`,
    contentUrl: w.previewUrl ?? undefined,
    thumbnailUrl: w.previewUrl ?? undefined,
    keywords: w.tags?.length ? w.tags.join(', ') : undefined,
    license: `${site}/licence`,
    acquireLicensePage: `${site}${path}`,
    creditText: brand,
    creator: { '@type': 'Organization', name: brand },
    copyrightNotice: `© ${brand}`,
    isFamilyFriendly: true,
    datePublished: w.created_at ?? undefined,
  };
}

export function itemListLd(site: string, items: { name: string; path: string }[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: `${site}${it.path}`, name: it.name })),
  };
}

/** FAQPage — answers that search engines and AI assistants can quote. Answers are plain text. */
export function faqLd(items: { q: string; a: string }[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

/** True when a listing URL carries filters/sort/search/page params — those pages are noindex,follow (duplicates of the base list). */
export function isFilteredListing(params: Record<string, string | string[] | undefined>): boolean {
  return Object.entries(params).some(([k, v]) => v !== undefined && v !== '' && k !== 'utm_source' && k !== 'utm_medium' && k !== 'utm_campaign');
}
