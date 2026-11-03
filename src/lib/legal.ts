import 'server-only';

import { getSettings, sellerDetails } from '@/lib/settings';
import { publicEnv } from '@/lib/env';

/** Business + grievance contact details used across policy pages. */
export async function getLegalContext() {
  const settings = await getSettings();
  const seller = sellerDetails(settings, publicEnv.NEXT_PUBLIC_BRAND_NAME);
  const l = settings.legal;
  const email = seller.supportEmail || 'support@hirecwallp.com';
  return {
    brand: publicEnv.NEXT_PUBLIC_BRAND_NAME,
    legalName: seller.name,
    address: seller.address,
    gstin: seller.gstin,
    email,
    grievance: {
      name: l.grievance_name || seller.name,
      designation: l.grievance_designation || 'Grievance Officer',
      email: l.grievance_email || email,
      phone: l.grievance_phone,
    },
    city: l.jurisdiction_city,
    settings,
  };
}
