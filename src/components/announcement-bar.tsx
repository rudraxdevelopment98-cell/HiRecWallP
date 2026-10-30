import Link from 'next/link';
import { getSettings } from '@/lib/settings';

/** Site-wide message set in Admin → Settings (e.g. a sale or maintenance note). */
export async function AnnouncementBar() {
  const { announcement, store_open } = await getSettings();
  const text = !store_open
    ? 'Checkout is temporarily closed — browsing and free downloads still work.'
    : announcement.enabled
      ? announcement.text
      : '';
  if (!text) return null;
  const inner = <span className="font-medium">{text}</span>;
  return (
    <div className="bg-foreground px-4 py-2 text-center text-xs text-background">
      {store_open && announcement.href ? (
        <Link href={announcement.href} className="underline-offset-2 hover:underline">
          {inner} →
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}
