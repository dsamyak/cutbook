
# CutBook — Salon Management Webapp

Your PRD/TRD describes a 16-module system (clients, services, billing, dues, discounts, products, expenses, gift cards, staff salary + incentives + overtime, reminders, reports, bridal/groom packages, WhatsApp, PDF invoices, etc.). That's 4–6 weeks of full-time engineering. I can absolutely build it, but shipping it as one mega-turn would produce shallow, half-broken screens. Instead I'll build it in tight phases where each phase is genuinely usable.

## Stack (replacing the PRD's Next/Express/Prisma)
- TanStack Start (Vite + React 19) — current Lovable template
- Lovable Cloud (Postgres + Auth + Storage + serverless functions) — replaces Supabase/Express/Prisma
- shadcn/ui + Tailwind v4
- Recharts for charts, jsPDF for invoices, Lovable AI for any smart features

## Phase 1 — Foundation (this turn)
1. Enable Lovable Cloud
2. Auth: email/password login, Admin + Barber roles (separate `user_roles` table, no client-side role checks)
3. Database schema (all tables now, so later phases just plug in):
   clients, services, service_categories, products, bills, bill_items, payments, gift_cards, gift_card_transactions, expenses, barbers, attendance, salary_records, reminders, discount_rules
4. Seed services from your TONI&GUY rate card (Hair, Ironing, Color, Facials, Bridal/Groom packages, etc. — all rates loaded)
5. Admin Dashboard with KPIs (clients, today's bills, revenue, dues, expenses, active gift cards), top services chart, barber performance, recent transactions, quick search, quick actions
6. Client Management: list, profile page, full service history, dues, search by name/phone
7. Service catalog: browse all services with rates, by category
8. Billing flow v1: pick client → pick barber → add services + products → discount (% or flat) → split payment (cash/UPI/card/gift card) → mark partial/full paid → save bill
9. Bill view + print-friendly invoice

## Phase 2 — Operations
- Expenses module (categories, vendor, summary, profit)
- Products inventory (stock, low-stock alerts, auto-decrement on sale)
- Gift cards (issue, redeem partial/full, history, expiry)
- Due settlement screen + dunning list
- PDF invoice download (jsPDF)

## Phase 3 — Staff & Payroll
- Barbers: profile, monthly base salary
- Attendance with check-in time → overtime calc based on arrival
- Incentive engine (5% @ ₹50k, 7% @ ₹75k, 10% @ ₹100k, 12% @ ₹150k, 15% @ ₹200k revenue)
- Monthly salary slip
- Barber-side login (PIN) to log own services & view earnings

## Phase 4 — Engagement & Reports
- Reminders (birthday, follow-up after N days) — scheduled via cron-style serverless job
- WhatsApp/SMS bill send (requires Twilio/Gupshup key — I'll ask when we get there)
- Reports: daily/monthly sales, barber performance, service mix, expenses, profit — with date range + CSV export
- Loyalty / auto-discount rules

## What I need from you to start Phase 1
Just a yes. I'll enable Cloud, seed your rate card, and ship phase 1 in this turn. WhatsApp/SMS provider keys and any branding preferences I'll ask for at the relevant phase.

Approve and I'll start building Phase 1 immediately.
