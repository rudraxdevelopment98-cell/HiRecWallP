import 'server-only';

import { headers } from 'next/headers';

/** True while rendering an /admin page (set by middleware as x-hw-path). */
export async function isAdminRoute(): Promise<boolean> {
  const path = (await headers()).get('x-hw-path') ?? '';
  return path === '/admin' || path.startsWith('/admin/');
}
