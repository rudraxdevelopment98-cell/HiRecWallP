import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { storage } from '@/lib/storage';

/** Daily: roll up raw events older than 30 days into events_daily and prune. */
export async function runHousekeeping(): Promise<Record<string, unknown>> {
  const { data, error } = await createServiceClient().rpc('housekeeping', { p_keep_days: 30 });
  if (error) throw error;
  // Supabase Storage has no lifecycle rules: delete expired temp files here.
  const tempFilesRemoved = await storage().cleanupTemporary();
  // Privacy Policy retention: old resolved support requests (not tied to an order).
  const { data: tickets } = await createServiceClient().rpc('support_retention');
  return { eventsRolledUp: Number(data ?? 0), tempFilesRemoved, supportTicketsDeleted: Number(tickets ?? 0), storage: storage().id };
}
