import { createClient } from '@/lib/supabase/server';

export interface CreatorRow {
  user_id: string;
  display_name: string | null;
  payout_provider: string | null;
  payout_account_id: string | null;
  kyc_status: string;
  commission_pct: number;
  agreement_accepted_at: string | null;
}

/** The current user's creator row (RLS: own only), or null if not a creator. */
export async function getCreator(): Promise<CreatorRow | null> {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data } = await supabase
      .from('creators')
      .select('user_id, display_name, payout_provider, payout_account_id, kyc_status, commission_pct, agreement_accepted_at')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    return (data as CreatorRow) ?? null;
  } catch {
    return null;
  }
}
