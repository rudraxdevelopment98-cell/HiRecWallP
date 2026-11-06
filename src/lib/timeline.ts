/** Customer timeline (B6): one list of everything that happened on an account. Pure parts. */

export type TimelineKind = 'order' | 'credit' | 'ticket' | 'download' | 'signin' | 'staff' | 'email';

export interface TimelineEvent {
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  href?: string;
}

/** Newest first, capped. Events without a valid time are dropped. */
export function mergeTimeline(lists: TimelineEvent[][], limit = 120): TimelineEvent[] {
  return lists
    .flat()
    .filter((e) => !Number.isNaN(Date.parse(e.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}

const REASON: Record<string, string> = {
  purchase: 'bought',
  bonus: 'bonus',
  welcome: 'welcome bonus',
  referral: 'referral reward',
  spend: 'spent',
  refund: 'refunded',
  admin_adjust: 'adjusted by staff',
  expire: 'expired',
  closure: 'forfeited on closing the account',
};

export function creditEventTitle(delta: number, reason: string): string {
  const n = Math.abs(delta);
  const word = n === 1 ? 'credit' : 'credits';
  return `${delta > 0 ? '+' : '−'}${n} ${word} · ${REASON[reason] ?? reason}`;
}

const SIGNIN: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  user_signedup: 'Created the account',
  user_recovery_requested: 'Asked for a password reset',
  user_updated_password: 'Changed the password',
  factor_in_progress: 'Started two-factor set-up',
  factor_unenrolled: 'Removed two-factor',
};
export const signinTitle = (action: string) => SIGNIN[action] ?? action;

const STAFF_ACTION: Record<string, string> = {
  'customer.credits': 'Staff adjusted credits',
  'customer.gift': 'Staff gifted a wallpaper',
  'customer.block': 'Staff blocked the account',
  'customer.unblock': 'Staff unblocked the account',
  'customer.role': 'Staff changed the role',
  'customer.price_country': 'Staff changed the price country',
  'staff.add': 'Given staff access',
  'staff.set_role': 'Staff role changed',
  'staff.remove': 'Staff access removed',
  'staff.reset_mfa': 'Two-factor reset by the owner',
};
export const staffActionTitle = (action: string) => STAFF_ACTION[action] ?? `Staff: ${action}`;
