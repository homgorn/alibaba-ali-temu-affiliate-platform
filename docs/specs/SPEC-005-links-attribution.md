# SPEC-005 — Affiliate Links, Attribution & Monetisation Integrity

| Field | Value |
|---|---|
| **ID** | SPEC-005 |
| **Status** | **Approved** |
| **Author** | orchestrating agent |
| **Date** | 2026-10-08 |
| **Reviewers** | operator (pending) |
| **Depends on** | SPEC-001, SPEC-003, SPEC-004 |
| **Evidence** | [`docs/wiki/20-affiliate-programs/ALIEXPRESS-AFFILIATE.md`](../wiki/20-affiliate-programs/ALIEXPRESS-AFFILIATE.md) · [`research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md`](../../research/raw/r01-aliexpress-affiliate-api/002-affiliate-api-spec-verified.md) |

---

## 1. Context

Everything else in this project exists to produce a click. This spec governs how
a link is built, how a click is attributed to us, and — most importantly — how
the system stays honest about what it does not know.

### Verified facts this spec must respect

| Fact | Value | Source |
|---|---|---|
| Promotion link format | `http://s.click.aliexpress.com/e/xxxxx` | vendor docs, 2026-10-08 |
| Cookie window | **3 days** | 3 independent programme directories |
| Commission | 0–9% nominal, up to 90% on Hot Products | vendor marketing page |
| Bulk feed includes links | `hotproduct.download` returns `promotion_link` | vendor docs |
| Payout minimum | $16 | 2 secondary sources |
| Payout delay | Net 60 | 1 secondary source — **LOW confidence** |
| Platform-provided links | Alibaba B2B: **no MMP, own attribution only** | platform ToS |

### ⚠️ Three constraints that shape everything

**First, 3 days is brutally short.** A buyer who clicks Monday and buys Thursday
is lost. This is not a detail — it determines that content must convert *within*
the click, and that remarketing against a 3-day-old click is structurally
impaired.

**Second, we are not the attribution authority.** Every network reports
conversions in *its* dashboard using *its* logic. Our numbers and theirs will
disagree. That disagreement is not an error to eliminate — it is the signal that
reveals misattribution, cookie theft and fraud (R08 constraint).

**Third, links are volatile.** A stored `promotion_link` is a **cached claim**,
not a guarantee. SPEC-003 FR-14 already requires `observed_at` so staleness is
computable. This spec must honour that rather than pretending a link is durable.

---

## 2. Functional Requirements

### 2.1 Link construction

- **FR-1** The system MUST prefer a **module-provided `promotion_link`** when the
  feed supplies one, over constructing one locally. The platform's own link is
  more likely to be current.
- **FR-2** Link construction MUST be **per-module**, behind the module contract.
  Link formats are network-specific and MUST NOT leak into engine code.
- **FR-3** Every generated link MUST carry the operator's tracking identifier in
  the network-specified parameter position.
- **FR-4** Link generation MUST NOT be performed for a product with
  `monetisable = false` **as a monetised link**. Either no link is issued, or it
  is issued and **explicitly marked non-monetised** (SPEC-001 FR-19).
- **FR-5** A link MUST NEVER be generated for a destination prohibited by that
  network's policy. ⚠️ Alibaba.com B2B explicitly refuses Russian traffic and
  refuses all MMP integration — B2B links MUST be geo-gated and MUST NOT be
  postback-based (SPEC-001 EC-13 pattern, D-009).

### 2.2 Link validity

- **FR-6** Every stored link MUST carry `observed_at` and an initial `status` of
  `unknown` (SPEC-003 FR-14).
- **FR-7** Link validity MUST be **revalidatable**. A check MUST distinguish
  `valid` / `invalid` / `unknown`, and MUST NOT treat an expired-but-working link
  as permanently valid.
- **FR-8** A link found `invalid` MUST be **regenerated or suppressed**, never
  served while known-invalid.

### 2.3 Click tracking

- **FR-9** Outbound clicks MUST be recorded with: timestamp, product,
  destination country, and **the channel that produced the click**. Without the
  channel, EPC per channel is uncomputable and the business cannot be evaluated
  (this is roadmap gap M1, issue #2).
- **FR-10** Visitor identification MUST use a **salted hash**, never a raw IP.
  The salt MUST be unique per deployment — reusing it across sites links visitors
  between them, which is a privacy harm.
- **FR-11** Tracking MUST be **cookie-free where possible**. A first-party,
  short-lived identifier is preferable to a persistent cookie: it reduces
  consent burden and improves the fraction of measurable clicks.
- **FR-12** Tracking MUST NOT block or delay the outbound navigation. A failed
  tracker MUST never prevent a user reaching the product.

### 2.4 Attribution honesty

- **FR-13** The system MUST store **our** attribution and **the network's**
  reported conversions **separately**, and MUST NOT silently reconcile them into
  one number.
- **FR-14** A conversion MUST be marked **overdue** once it exceeds the network's
  cookie window with no reported conversion. "We saw a click but no sale" is
  information; it must not be presented as either a sale or a non-click.
- **FR-15** Commission MUST be recorded **as actually reported by the network**,
  including delays, holds and clawbacks. A projected commission is not a
  commission.
- **FR-16** Deferred-commission networks MUST be modelled explicitly. Alibaba B2B
  pays only at `TradeCompleted`, and requires the paid→completed gap to be
  **under 180 days** (verified).

### 2.5 Disclosure and trust

- **FR-17** Every page containing an affiliate link MUST display a **clear
  disclosure**, present in the server HTML without JavaScript (SPEC-004 FR-24 —
  a legal requirement cannot depend on client execution).
- **FR-18** Disclosure MUST be **honest about the incentive**, not boilerplate.
  Recommended: "We may earn a commission if you buy through this link. It does
  not affect the price you pay, and it does not affect our analysis."
- **FR-19** ⚠️ **The incentive MUST NOT alter the analysis.** If a product is a bad
  deal, the page says so whether or not it is monetised. This MUST be testable:
  a non-monetisable product's page MUST contain the same verdict structure as a
  monetisable one.

### 2.6 Fraud resistance

- **FR-20** Self-referral and own-click MUST be detectable: clicks from our own
  infrastructure MUST be identifiable and excluded from reported EPC.
- **FR-21** The system MUST NOT implement or facilitate cookie stuffing, click
  injection, link swapping, or browser extensions that inject affiliate links.
  These are fraudulent and are **rejected on principle** — the project's asset is
  trust, and it is destroyed by the same act that generates it.

---

## 3. Non-Functional Requirements

| # | Requirement | Threshold |
|---|---|---|
| **NFR-1** | Redirect latency added by tracking | < 50 ms |
| **NFR-2** | Tracker failure impact on navigation | **Zero** — click must still work |
| **NFR-3** | Click→sale attribution window | Match the network's window exactly (3 days AliExpress), never longer |
| **NFR-4** | Link revalidation staleness | No served link older than its validity TTL without recheck |
| **NFR-5** | PII in click records | **Zero** raw IPs stored |
| **NFR-6** | Disclosure present on monetised pages | 100% |
| **NFR-7** | Our-vs-network attribution delta | Reported, never hidden |

---

## 4. Acceptance Criteria

**AC-1** *(FR-1)* — Given a feed row containing `promotion_link`, when a link is
requested, then the feed's link is used verbatim and no local construction occurs.

**AC-2** *(FR-2)* — Given two modules with different link formats, when both
register, then neither's format knowledge appears in engine code.

**AC-3** *(FR-3)* — Given a generated link, when inspected, then it contains the
operator's tracking identifier in the position that module declared.

**AC-4** *(FR-4)* — Given a product with `monetisable = false`, when a link is
requested, then the response is marked non-monetised — **never a bare link that
looks monetised**.

**AC-5** *(FR-5)* — Given a prohibited destination for a module, when a link is
requested, then the request is refused with a clear per-network policy error, and
**no link is returned**.

**AC-6** *(FR-6, FR-7)* — Given a stored link, when queried, then `observed_at`
and `status` are returned, and `status` can be updated by revalidation.

**AC-7** *(FR-8)* — Given a link whose `status = invalid`, when a page renders,
then that link is **not** served — the product shows an alternative or a clear
unavailable state.

**AC-8** *(FR-9)* — Given a click from a distinguishable channel, when recorded,
then the channel is retrievable, and EPC for that channel is computable.

**AC-9** *(FR-10, NFR-5)* — Given a click record, when inspected, then it contains
a **salted hash** and **no raw IP address**.

**AC-10** *(FR-11)* — Given a visitor with cookies fully blocked, when they click,
then the click is still recorded via the first-party identifier.

**AC-11** *(FR-12, NFR-2)* — Given the tracker deliberately failing, when a user
clicks a product link, then **the navigation still succeeds**.

**AC-12** *(FR-13, NFR-7)* — Given our recorded click→sale count and the
network's reported count differ, when reconciliation runs, then **both** figures
are shown and the delta is reported. Neither is silently preferred.

**AC-13** *(FR-14, NFR-3)* — Given a click with no conversion after the cookie
window expires, when queried, then it appears as **overdue**, distinct from both
"converted" and "never clicked".

**AC-14** *(FR-15)* — Given a commission reported as pending, when stored, then
its status is `pending`, not `earned`. A clawback MUST reduce the recorded amount.

**AC-15** *(FR-16)* — Given a B2B order, when its commission is recorded, then it
remains `pending` until `TradeCompleted`, and an order exceeding the 180-day gap
is flagged.

**AC-16** *(FR-17, SPEC-004 FR-24)* — Given a page with an affiliate link, when
the raw HTML is fetched with JavaScript disabled, then the disclosure text is
present.

**AC-17** *(FR-18)* — Given a monetised page, when the disclosure is read, then
it states that a commission may be earned **and** that it does not affect the
price or the analysis.

**AC-18** *(FR-19)* — Given two products, one monetisable and one not, when their
pages are compared, then the **verdict structure is identical**. If the analysis
differs based on monetisation, the test FAILS.

**AC-19** *(FR-19)* — ⭐ Given a product where the honest verdict is "not actually
cheaper", when the page renders, then it says so — **regardless of whether the
product is monetisable**.

**AC-20** *(FR-20)* — Given a click originating from our own egress IP range, when
recorded, then it is flagged `self_referred` and excluded from reported EPC.

**AC-21** *(FR-21)* — Given a source scan of the codebase, when searched, then no
implementation of cookie stuffing, click injection or link swapping exists.

---

## 5. Edge Cases

| # | Case | Required behaviour |
|---|---|---|
| **EC-1** | Feed `promotion_link` present but 404s | Revalidate (FR-7), then fall back to local construction, then to a clear unavailable state. **Never** serve a known-dead link. |
| **EC-2** | No feed link and local construction requires an API call that costs budget | Prefer a non-tracked direct link with honest labelling over spending budget silently. Record that no tracked link was available. |
| **EC-3** | Same product, two destinations, one prohibited by policy | Serve the tracked link for the permitted destination, and state unavailability for the other. Never generate the prohibited one. |
| **EC-4** | Click arrives 2.9 days after a previous click | Both count as separate clicks; attribution attaches to the most recent within the window. Multi-click is normal, not an error. |
| **EC-5** | Sale reported by the network with no matching click of ours | Record as **unattributed**, not as ours. Inflating our numbers is the failure this whole spec exists to prevent. |
| **EC-6** | Our click recorded, network reports a sale outside our window | Report the discrepancy (AC-12). **Do not** silently claim the sale. |
| **EC-7** | Commission rate changes after a click | The rate at conversion time governs. Historical clicks MUST NOT be repriced at a new rate retroactively. |
| **EC-8** | Refund/chargeback after a recorded commission | Clawback MUST reduce the recorded amount (AC-14). Overstated earnings are worse than slow earnings. |
| **EC-9** | Product delisted between click and conversion | Attribute normally — we did not cause it, and hiding it would hide real EPC data. |
| **EC-10** | Network changes its link format | Versioned per module. Old links keep working until revalidated; new builds use the new format. |
| **EC-11** | User blocks all cookies AND the first-party ID | The click is unmeasurable. Serve the link anyway (FR-12). **A lost measurement is acceptable; a lost user is not.** |
| **EC-12** | Duplicate network report for one order | Idempotent by order id. Never double-count. |
| **EC-13** | B2B order where paid→completed exceeds 180 days | Flag as outside the qualifying window; do not expect commission. |
| **EC-14** | Disclosure text itself fails to render | Fail the build (SPEC-004). A page with a hidden commission is a legal exposure. |

---

## 6. API Contracts

```ts
export type LinkStatus = 'valid' | 'invalid' | 'unknown';

export interface AffiliateLink {
  readonly url: string;
  readonly networkId: string;
  readonly productId: string;
  readonly source: 'feed' | 'constructed';   // FR-1
  readonly monetised: boolean;               // false ⇒ do NOT present as earning (FR-4)
  readonly status: LinkStatus;
  readonly observedAt: string;
  readonly destinationCountry: string | null;
  readonly refusalReason?: string;           // set when a policy blocked generation (FR-5)
}

export interface ClickEvent {
  readonly clickId: string;
  readonly productId: string;
  readonly networkId: string;
  readonly destinationCountry: string | null;
  readonly channel: string;                  // REQUIRED (FR-9) — without it EPC is uncomputable
  readonly clickedAt: string;
  readonly visitorHash: string;              // salted, never raw IP (FR-10)
  readonly selfReferred: boolean;            // FR-20
}

export type ConversionStatus =
  | 'pending'        // network has not confirmed (FR-15)
  | 'converted'
  | 'refunded'
  | 'overdue'        // past cookie window, no report (FR-14)
  | 'unattributed';  // network reported a sale we have no click for (EC-5)

export interface AttributionRecord {
  readonly networkReportedConversions: number;
  readonly ourRecordedConversions: number;
  readonly delta: number;
  readonly periodStart: string;
  readonly periodEnd: string;
  /** Deliberately NOT reconciled. Both figures are surfaced (FR-13). */
  readonly reconciled: false;
}

export interface CommissionRecord {
  readonly networkId: string;
  readonly externalOrderId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: 'pending' | 'earned' | 'clawed_back';
  readonly commissionRateApplied: number;    // rate AT conversion time (EC-7)
  readonly requiresTradeCompleted: boolean;  // B2B (FR-16)
  readonly reportedAt: string;
}

export interface DisclosureText {
  readonly text: string;
  readonly present: true;                    // always true on a monetised page
}
```

---

## 7. Data Models

### `link_validity_check`

| Field | Type | Constraints |
|---|---|---|
| `link_id` | uuid | **PK**, FK → `promotion_link` |
| `checked_at` | timestamptz | NOT NULL |
| `status` | text | NOT NULL — `valid` \| `invalid` \| `unknown` |
| `http_status` | integer | NULL |
| `check_source` | text | NOT NULL — `head` \| `full` |

### `click_event`

| Field | Type | Constraints |
|---|---|---|
| `click_id` | uuid | **PK** |
| `product_id` | uuid | NOT NULL, FK → `product` |
| `network_id` | text | NOT NULL |
| `destination_country` | text | NULL |
| `channel` | text | **NOT NULL** — FR-9 |
| `clicked_at` | timestamptz | NOT NULL |
| `visitor_hash` | text | NOT NULL — **salted**, never raw IP |
| `self_referred` | bool | NOT NULL default false |
| `expires_at` | timestamptz | NOT NULL — cookie window end (NFR-3) |

> Index on `(product_id, clicked_at DESC)` and `(channel, clicked_at)`.

### `conversion_event`

| Field | Type | Constraints |
|---|---|---|
| `conversion_id` | uuid | **PK** |
| `network_id` | text | NOT NULL |
| `external_order_id` | text | NOT NULL — unique per network (EC-12) |
| `click_id` | uuid | **NULL** — NULL = unattributed (EC-5) |
| `status` | text | NOT NULL — see `ConversionStatus` |
| `amount_minor` | integer | NOT NULL |
| `currency` | text | NOT NULL |
| `reported_at` | timestamptz | NOT NULL |
| `trade_completed_at` | timestamptz | NULL — B2B (FR-16) |
| `paid_at` | timestamptz | NULL — for the 180-day check (EC-13) |

### `commission_record`

| Field | Type | Constraints |
|---|---|---|
| `record_id` | uuid | **PK** |
| `conversion_id` | uuid | NOT NULL, FK → `conversion_event` |
| `amount_minor` | integer | NOT NULL |
| `currency` | text | NOT NULL |
| `status` | text | NOT NULL — `pending` \| `earned` \| `clawed_back` |
| `commission_rate_applied` | numeric | NOT NULL — frozen at conversion (EC-7) |
| `paid_out_at` | timestamptz | NULL |

---

## 8. Out of Scope

| Excluded | Reason |
|---|---|
| **Fraudulent techniques** — cookie stuffing, click injection, link swapping, link-injecting extensions | FR-21. Rejected on principle. A project whose trust is its asset cannot be built on deception. |
| **MMP integration (AppsFlyer, Adjust)** | Alibaba B2B explicitly refuses it (verified). Adds cost and complexity; not needed for one operator. |
| **Server-to-server postback** | AliExpress provides its own attribution. Postback is a later concern if a network requires it. |
| **Multi-network commission reconciliation automation** | Requires dashboard access per network; not available without credentials. Model is defined, ingestion is manual until then. |
| **Payout/tax calculation** | A business/finance concern, not an engineering one. |
| **A/B testing link variants** | Would fragment attribution before any traffic exists. |
| **Building the analytics dashboard UI** | Blocked on the tracking decision (issue #2). Tables land first. |
| **Retargeting audiences** | Structurally impaired by the 3-day window (verified). |
| **Predicting conversions** | Requires conversion history that does not exist yet. |

---

## 9. Open Questions

| # | Question | Blocking? |
|---|---|---|
| Q1 | Is `promotion_link` stable per product or generated per request? | **No** — EC-1/FR-7 handle both; affects revalidation cost only |
| Q2 | Does the network offer postback for AliExpress? | No — own attribution assumed |
| Q3 | Exact payout schedule (Net 60 was **one** low-confidence source) | **No for engineering** — cash-flow planning only |
| Q4 | Channel taxonomy — what values are "distinguishable"? | **Yes for AC-8** — needs the tracking decision (issue #2) |
| Q5 | Do we need our own attribution at all, given the network reports its own? | **Yes** — R08: without our own click data, the network-vs-us delta (the fraud signal) cannot exist |

**⚠️ The tracking decision (issue #2) blocks AC-8 and therefore most of §2.3.**
The tables in §7 can be built now; the channel taxonomy must be settled before
AC-8 can pass.

**Verified and relied upon:** promotion link format, 3-day cookie window,
commission ranges, `hotproduct.download` providing links, Alibaba B2B's refusal of
MMP attribution and its `TradeCompleted` + 180-day rules.
