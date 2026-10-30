import { redirect } from 'next/navigation';

type SearchParams = { [key: string]: string | string[] | undefined };

/** Search lives on Explore (same filters, sorting and pages). */
export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = searchParams.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  redirect(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
}
