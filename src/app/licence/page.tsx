import type { Metadata } from 'next';
import { LegalDoc } from '@/components/legal/legal-doc';
import { getLegalContext } from '@/lib/legal';

export const metadata: Metadata = { title: 'Licence' };
export const dynamic = 'force-dynamic';

export default async function LicencePage() {
  const c = await getLegalContext();
  return (
    <LegalDoc
      policy="licence"
      intro={
        <p>
          When you add a wallpaper to your library you get a licence to use it — you don&rsquo;t buy the artwork itself. There are two licences:
          <strong> Personal</strong> (standard) and <strong>Commercial</strong> (5 credits, or included in Business plans).
        </p>
      }
      sections={[
        {
          id: 'personal',
          heading: 'Personal licence',
          body: (
            <>
              <p>You may:</p>
              <ul>
                <li>use the wallpaper as a background on your own phones, tablets, computers, TVs and watches;</li>
                <li>use it as a profile banner or background on your own non-commercial social accounts;</li>
                <li>print it for your own home, not for sale.</li>
              </ul>
              <p>You may not resell, share, upload or give away the file (or an edited version), or use it to promote a business.</p>
            </>
          ),
        },
        {
          id: 'commercial',
          heading: 'Commercial licence',
          body: (
            <>
              <p>Everything in the personal licence, plus:</p>
              <ul>
                <li>ads, marketing, presentations, websites, apps and videos for your business or your clients;</li>
                <li>business social-media posts and thumbnails;</li>
                <li>physical products you sell (prints, cases, apparel) up to 5,000 units per wallpaper.</li>
              </ul>
              <p>
                Still not allowed: selling or giving away the image as a standalone file, wallpaper pack, stock image or NFT; registering it as a
                trademark or logo; using it in ways that are illegal, hateful, misleading or that suggest a person or brand endorses you.
              </p>
            </>
          ),
        },
        {
          id: 'ai',
          heading: 'AI-generated artwork',
          body: (
            <p>
              Every wallpaper is AI-generated (some are edited by people) and labelled as such. Copyright in AI-generated images is unsettled in
              many countries, so your rights come from this licence — a contract with {c.legalName} — rather than from a transfer of copyright.
              Licences are non-exclusive: other customers can license the same wallpaper.
            </p>
          ),
        },
        {
          id: 'protection',
          heading: 'How files are protected',
          body: (
            <p>
              Previews carry a visible watermark. Purchased files carry an invisible mark linked to your order, so leaked copies can be traced. Sharing
              a purchased file ends your licence and may close your account.
            </p>
          ),
        },
        {
          id: 'duration',
          heading: 'How long it lasts',
          body: (
            <p>
              The licence is permanent for the uses above, including after a membership ends. If a wallpaper is removed (for example after a valid
              rights complaint), you can keep using copies you already downloaded for personal use, and we will offer a replacement or credit.
            </p>
          ),
        },
      ]}
    />
  );
}
