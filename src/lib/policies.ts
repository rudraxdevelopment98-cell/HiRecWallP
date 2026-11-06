/**
 * Policy versions. Bump `version` (and `effective`) when a policy changes
 * materially; acceptances are recorded per version (policy_acceptances).
 */
export const POLICIES = {
  terms: { title: 'Terms of Service', href: '/terms', version: '2026-11-05', effective: '5 November 2026' },
  privacy: { title: 'Privacy Policy', href: '/privacy', version: '2026-11-06', effective: '6 November 2026' },
  refunds: { title: 'Refund & Cancellation Policy', href: '/refunds', version: '2026-11-03.2', effective: '3 November 2026' },
  delivery: { title: 'Shipping & Delivery Policy', href: '/delivery', version: '2026-11-06', effective: '6 November 2026' },
  licence: { title: 'Licence', href: '/licence', version: '2026-11-03', effective: '3 November 2026' },
  grievance: { title: 'Grievance Redressal', href: '/grievance', version: '2026-11-03', effective: '3 November 2026' },
} as const;

export type PolicyKey = keyof typeof POLICIES;
