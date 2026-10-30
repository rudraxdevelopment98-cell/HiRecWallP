import { redirect } from 'next/navigation';

type SearchParams = { [key: string]: string | string[] | undefined };

/** Search lives on Explore (same filters, sorting and pages). */
export default async function SearchPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const raw = searchParams.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  redirect(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
}
