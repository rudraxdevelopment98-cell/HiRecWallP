# Tax & compliance — how HirecWallp handles it

Plain-language guide for the owner. Researched November 2026 against current
rules (Income-tax Act 2025 in force from 1 April 2026; CGST/IGST Acts). The site
automates the tracking; filing is still yours. This is not professional advice —
when a number below matters, confirm it on **gst.gov.in** or **incometax.gov.in**.
Everything the site uses lives in **Admin → Tax centre** and can be changed
without code if a rule changes.

## 1. GST

| Situation | What the law says | What the site does |
|---|---|---|
| Turnover below ₹20 lakh/FY (₹10 lakh in special-category states) | Service suppliers making inter-state supplies don't need GST registration (Notification 10/2017-IGST) | Receipts say "Supplier not registered under GST; no GST charged". Tax centre tracks turnover (India + exports, refunds excluded) |
| Turnover reaches 75% / 90% / 100% of the limit | Register within 30 days of crossing | Tax centre turns amber → orange → red and lists the steps |
| Registered, sale in India | 18% GST included in price. Same state → CGST 9% + SGST 9%; consumers without an address on record default to the supplier's location; business buyer in another state → IGST 18% | Receipts become Tax Invoices with the right split (state = first two digits of GSTIN) |
| Registered, sale abroad | Export of services is zero-rated if you file a **Letter of Undertaking (LUT)** each FY; otherwise charge IGST and claim a refund | "LUT filed" switch; receipts say "Supply meant for export under LUT without payment of IGST" |
| Creators selling through the site | E-commerce operators collect GST TCS (0.5%) on supplies made by other registered suppliers (s.52) and must register for that | ⚠️ Watch item: once outside creators earn real money, register and check s.52/s.9(5) applicability |

**To register (free):** gst.gov.in → Services → Registration → New Registration.
Keep PAN, Aadhaar, a bank statement/cheque and address proof ready.
After approval: enter GSTIN in Admin → Settings → Business details, switch on
"GST registered" in Tax centre, file the LUT (GST portal → Services → User
Services → Furnish LUT) before the first export invoice of each FY.

## 2. Income tax (owner)

- **Simplified scheme, s.58 (old 44AD):** businesses up to ₹2 crore turnover
  (₹3 crore when cash receipts ≤ 5%) may declare **6% of digital receipts** as
  profit and skip detailed books. Every sale on the site is digital, so 6% applies.
  Tax centre shows this presumed profit; the tax on it depends on your slab.
- **Advance tax:** on the presumptive scheme, one instalment by **15 March**.
- **Return:** by **31 July** (non-audit cases) — the simple form for presumptive income.

## 3. TDS on creator payouts

Applies only when creators (other people) earn money. The payout job deducts
automatically and records it on every payout row.

| Payment | Section (Act 2025) | Rate | Threshold |
|---|---|---|---|
| Creator's sales through the platform | s.393(1) Table 8(v) (old 194-O) | 0.1% with PAN, 5% without | Individuals/HUF with PAN: no TDS while FY sales ≤ ₹5 lakh |
| Affiliate commission | s.393(1) Table 1(ii) (old 194H) | 2% with PAN, 20% without | Above ₹20,000 per FY (catch-up deduction when crossed) |
| Non-resident creators | Different rules / tax treaties | — | Not automated: the payout is flagged "review before paying" |

**Before the first deduction:** get a **TAN** (free, Form 49B on the
Protean/NSDL site) and enter it in Tax centre. Then each month deposit TDS by
the **7th** (challan 281) and each quarter file **Form 26Q** (31 Jul, 31 Oct,
31 Jan, 31 May). Admin → Tax centre → "Creator TDS register" is the data you need.

## 4. Credits, gift codes and RBI

Credits and gift codes can only be used on HirecWallp itself — a **closed-system
prepaid instrument**. RBI does not require authorisation for these (RBI PPI FAQ /
Master Directions 2021). Don't let credits be withdrawn as cash or spent with
third parties; that would change the classification.

Gift codes: CBIC Circular 243/37/2024 says vouchers themselves aren't a supply;
GST attaches to what they buy. The site treats a gift pack exactly like a credit
pack sale (invoiced when paid), which is the conservative approach.

## 5. Exchange rates

Foreign sales are converted to rupees for turnover and creator payouts at ECB
reference rates, fetched automatically on the 1st of every month (and on demand
from Tax centre). For the GST return of an export, use the rate on the invoice
date (the sales register shows currency + amount so this can be recomputed).

## 6. Monthly routine (15 minutes)

1. Admin → Tax centre: check the to-do box and upcoming dates.
2. Download the **sales register** (keep it; it is your sales book).
3. If creators were paid: download the **TDS register**, pay TDS by the 7th.
4. If GST registered: file GSTR-1 (11th) and GSTR-3B (20th) from the register.

## Sources

- GST registration limit for inter-state service suppliers — Notification 10/2017-IGST: https://taxguru.in/goods-and-service-tax/required-registered-gst.html · https://www.kanakkupillai.com/learn/new-gst-registration-threshold-limit-for-services/
- Export of services, LUT, FIRA: https://www.karboncard.com/blog/lut-gst-exports-guide · https://www.winvesta.in/blog/businesses/how-to-file-lut-for-export-of-services-gst-portal-guide-2025
- GST TCS on e-commerce operators (0.5% from 10 Jul 2024): https://www.gstcouncil.gov.in/sites/default/files/2024-02/faqs_tcs.pdf · https://www.taxaj.com/learn/gst-on-e-commerce-operators-tcs-under-section-52-step-by-step-guide/
- Vouchers under GST (CBIC, Dec 2024): https://business-standard.com/economy/news/cbic-clarifies-rules-says-no-gst-applicable-on-pre-paid-gift-vouchers-125010100967_1.html
- Income-tax Act 2025, s.393 TDS (e-commerce 0.1%): https://cleartax.in/s/section-393-of-income-tax-act · https://blog.tdsman.com/2026/07/tds-on-e-commerce-transactions-section-3931-194o/
- TDS on commission (2%, ₹20,000): https://blog.tdsman.com/2026/05/tds-on-brokerage-and-commission-section-3931-section-194h/
- Presumptive taxation s.58: https://taxguru.in/income-tax/analysis-presumptive-taxation-section-58-income-tax-act-2025.html
- RBI closed-system PPIs: https://www.rbi.org.in/commonperson/english/Scripts/FAQs.aspx?Id=2812
- Exchange rates (ECB via Frankfurter): https://frankfurter.dev
