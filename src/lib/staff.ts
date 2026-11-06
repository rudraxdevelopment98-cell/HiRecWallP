/**
 * Staff roles and per-area permissions (B6). Pure — used by middleware (the
 * gate for every /admin page and /api/admin call), requireAdmin(), the admin
 * sidebar and tests.
 *
 * Everyone with profiles.role = 'admin' is staff; staff_role narrows what they
 * can open. A null staff_role (accounts made admin before roles existed) counts
 * as owner.
 */

export const STAFF_ROLES = ['owner', 'manager', 'support', 'content'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type Area = 'overview' | 'sales' | 'catalogue' | 'pricing' | 'marketing' | 'business' | 'staff';

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  support: 'Support',
  content: 'Content',
};

export const ROLE_HELP: Record<StaffRole, string> = {
  owner: 'Everything, including staff and security settings.',
  manager: 'Everything except managing staff.',
  support: 'Orders, refunds, customers, support and messages.',
  content: 'Wallpapers, uploads, drafts, categories, creators and social posts.',
};

const ROLE_AREAS: Record<StaffRole, Area[]> = {
  owner: ['overview', 'sales', 'catalogue', 'pricing', 'marketing', 'business', 'staff'],
  manager: ['overview', 'sales', 'catalogue', 'pricing', 'marketing', 'business'],
  support: ['overview', 'sales'],
  content: ['overview', 'catalogue', 'marketing'],
};

/** Page path prefix (after /admin) and API prefix (after /api/admin) → area. Most specific first. */
const AREA_PREFIXES: [string, Area][] = [
  // overview: everyone
  ['guide', 'overview'],
  ['security', 'overview'],
  // sales (analytics shows revenue)
  ['analytics', 'sales'],
  ['orders', 'sales'],
  ['support', 'sales'],
  ['customers', 'sales'],
  ['messages', 'sales'],
  ['watermark', 'sales'],
  // catalogue
  ['catalogue', 'catalogue'],
  ['wallpapers', 'catalogue'],
  ['upload', 'catalogue'],
  ['drafts', 'catalogue'],
  ['categories', 'catalogue'],
  ['sets', 'catalogue'],
  ['review-queue', 'catalogue'],
  ['generation', 'catalogue'],
  ['prompts', 'catalogue'],
  ['publish', 'catalogue'],
  ['creators', 'catalogue'],
  // pricing
  ['credit-packs', 'pricing'],
  ['membership', 'pricing'],
  ['members', 'pricing'],
  ['plans', 'pricing'],
  ['plan-prices', 'pricing'],
  ['countries', 'pricing'],
  ['pricing', 'pricing'],
  ['price-rules', 'pricing'],
  // marketing
  ['growth', 'marketing'],
  ['social', 'marketing'],
  ['newsletter', 'marketing'],
  // business
  ['tax', 'business'],
  ['settings', 'business'],
  ['health', 'business'],
  ['activity', 'business'],
  ['storage', 'business'],
  // staff management
  ['staff', 'staff'],
];

export function effectiveRole(staffRole: string | null | undefined): StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(staffRole ?? '') ? (staffRole as StaffRole) : 'owner';
}

/** Area of an admin page or admin API path; unknown admin paths need the business area (owner/manager). */
export function areaForPath(path: string): Area {
  const rest = path.replace(/^\/api\/admin\/?/, '').replace(/^\/admin\/?/, '');
  if (rest === '') return 'overview';
  const first = rest.split('/')[0]!;
  const hit = AREA_PREFIXES.find(([p]) => p === first);
  return hit ? hit[1] : 'business';
}

export function canAccessArea(staffRole: string | null | undefined, area: Area): boolean {
  return ROLE_AREAS[effectiveRole(staffRole)].includes(area);
}

export function canAccessPath(staffRole: string | null | undefined, path: string): boolean {
  return canAccessArea(staffRole, areaForPath(path));
}

/** Paths a staff member may open while they still have to finish two-factor sign-in. */
export function isMfaExempt(path: string): boolean {
  return path === '/admin/security' || path.startsWith('/admin/security/');
}
