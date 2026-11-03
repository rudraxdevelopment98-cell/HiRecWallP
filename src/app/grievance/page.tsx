import type { Metadata } from 'next';
import { LegalDoc } from '@/components/legal/legal-doc';
import { getLegalContext } from '@/lib/legal';

export const metadata: Metadata = { title: 'Grievance Redressal' };
export const dynamic = 'force-dynamic';

export default async function GrievancePage() {
  const c = await getLegalContext();
  const g = c.grievance;
  return (
    <LegalDoc
      policy="grievance"
      intro={
        <p>
          Under the Consumer Protection (E-Commerce) Rules, 2020 and the Digital Personal Data Protection Act, 2023, you can raise any complaint
          about an order, a refund, your account or your personal data with our Grievance Officer.
        </p>
      }
      sections={[
        {
          id: 'officer',
          heading: 'Grievance Officer',
          body: (
            <div className="rounded-xl border bg-card p-4 text-foreground">
              <p className="font-semibold">{g.name}</p>
              <p className="text-muted-foreground">{g.designation}, {c.legalName}</p>
              <p>Email: {g.email}</p>
              {g.phone && <p>Phone: {g.phone}</p>}
              {c.address && <p className="whitespace-pre-line text-muted-foreground">{c.address}</p>}
            </div>
          ),
        },
        {
          id: 'how',
          heading: 'How to raise a complaint',
          body: (
            <p>
              Email the Grievance Officer with your name, the email on your account, the order number (if any) and what went wrong. Attach
              screenshots if helpful.
            </p>
          ),
        },
        {
          id: 'timelines',
          heading: 'What happens next',
          body: (
            <ul>
              <li>We acknowledge your complaint within <strong>48 hours</strong>, with a reference number.</li>
              <li>We resolve it within <strong>one month</strong> of receiving it, and tell you the outcome and reasons in writing.</li>
            </ul>
          ),
        },
        {
          id: 'escalation',
          heading: 'If you are not satisfied',
          body: (
            <p>
              You can contact the National Consumer Helpline (call 1915 or use consumerhelpline.gov.in), or file a consumer complaint online at
              e-daakhil.nic.in. For personal-data complaints you may approach the Data Protection Board of India after using this process.
            </p>
          ),
        },
      ]}
    />
  );
}
