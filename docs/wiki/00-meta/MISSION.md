# Mission

> **Summary:** Build an affiliate-marketing platform that gives a user a real
> answer they could not get from a search engine, and earn from their resulting
> decisions. The value is the product; the commission is the monetisation.

---

## The north star

**First real commission received.**

Not traffic. Not pageviews. Not a working system. Money that actually arrived
from a user who used the thing to make a decision. Everything else is a proxy for
it, and proxies can be optimised without producing value — which is precisely
the failure mode this project has to avoid.

## What "genuine value" means here

The user gets something a search engine could not give them:

- a **true landed cost** — item price + shipping + duty + VAT + delivery time,
  stated honestly, including what could not be determined;
- an **honest price history** — and the sentence "this discount is not real,
  it has been at this price for 8 months";
- a **cross-marketplace comparison** — the same product on AliExpress and Amazon,
  priced fairly;
- **explicit uncertainty** — "shipping unknown for this route" rather than a
  confident-looking zero.

The last one matters most. A tool that always produces a total will sometimes
produce a wrong one, and the user cannot tell which. Declaring the gaps is what
makes the numbers trustworthy.

## What this project deliberately refuses

These would earn more, short-term. They are rejected on purpose.

| Rejected | Why |
|---|---|
| Link dumps | No value; the user can do that already |
| Thin affiliate pages | Content exists to rank and to convert, not to inform |
| Fake-discount clickbait | Directly violates the north star — it is the exact lie the product exists to correct |
| Safety-critical categories | ⚠️ **Excluded outright** (D-012). Batteries, chargers, PPE, baby goods. A safety failure injures someone; warning-then-selling creates liability with no offsetting benefit. |
| Scraping / ToS-violating automation | A platform whose foundation is a ToS violation is one policy change from losing everything. The upside is some catalogue rows. |
| Incomplete totals presented as complete | The one failure that would destroy the thing that makes the product valuable |

## Why the commission follows the value

The structural reason this works, rather than just being a nice idea:

> An affiliate earns more when the user **buys**. A trustworthy comparison earns
> more when the user **trusts it**. Over enough traffic, those align — and the
> content that manipulates for a quick purchase is exactly the content that
> destroys the trust being monetised.

So honest work is not merely the ethical choice, it is the strategy with better
long-run economics. It is also the only version of this that survives contact
with a real legal entity.

## How success is measured

| Level | Metric |
|---|---|
| **Primary** | First real commission received and reconciled against our own records (F027) |
| **Secondary** | Validated unit economics — measured EPC, not assumed (F023, gap G25) |
| **Tertiary** | A public, useful, cited tool that keeps earning |

⚠️ **Not a success metric:** raw clicks. Optimised alone, it produces exactly the
content this project exists to reject.

## The open question that decides everything

Can a global/English-first audience be served profitably at AliExpress's
economics — a **3-day cookie** window and **0–9% nominal** commission?

**Not yet answered.** R06 is blocked with no data obtainable this session, and
decision D-020 forbids traffic spend until it is. The 3-day cookie is the
binding constraint; category commission dispersion (0–9% vs up to 90% on Hot
Products) means niche selection likely matters more than traffic tactics.

This project is built to find the answer honestly, including if the answer is
"not at this scale, in this niche, with this network" — which is a result worth
having before spending money, not a failure.

---

## Related

- [`AGENTS.md`](../../AGENTS.md) — the operating contract
- [`ROADMAP.md`](../../roadmap/ROADMAP.md) — phased plan
- [COMPETITIVE-LANDSCAPE](../60-product-synthesis/COMPETITIVE-LANDSCAPE.md) — why this gap is real
- [UNIT-ECONOMICS](../50-strategy-traffic/UNIT-ECONOMICS.md) — the arithmetic that decides viability
