-- SPEC-003 §6 + SPEC-005 §7 — monetisation, links, attribution, and the
-- ingestion support tables from SPEC-001 §7.

-- ---------------------------------------------------------------------------
-- promotion_link — SPEC-005 FR-6.
-- Links are VOLATILE: a stored link is a cached claim, not a guarantee.
-- observed_at makes staleness computable; status is 'unknown' until checked.
-- ---------------------------------------------------------------------------
CREATE TABLE promotion_link (
  link_id             @{UUID} PRIMARY KEY,
  product_id          @{UUID} NOT NULL REFERENCES product(product_id),
  destination_country @{TEXT},
  url                 @{TEXT} NOT NULL,
  -- FR-1 of SPEC-005: prefer the feed's own link over local construction.
  source              @{TEXT} NOT NULL CHECK (source IN ('feed','constructed')),
  -- SPEC-005 FR-4: false means this must NOT be presented as an earning link.
  monetised           @{BOOLEAN} NOT NULL DEFAULT 1,
  status              @{TEXT} NOT NULL DEFAULT 'unknown'
                      CHECK (status IN ('valid','invalid','unknown')),
  observed_at         @{TIMESTAMP} NOT NULL,
  UNIQUE (product_id, destination_country, url)
);

CREATE INDEX idx_promotion_link_status ON promotion_link(status, observed_at);

CREATE TABLE link_validity_check (
  link_id      @{UUID} PRIMARY KEY REFERENCES promotion_link(link_id),
  checked_at   @{TIMESTAMP} NOT NULL,
  status       @{TEXT} NOT NULL CHECK (status IN ('valid','invalid','unknown')),
  http_status  @{INT},
  check_source @{TEXT} NOT NULL CHECK (check_source IN ('head','full'))
);

-- ---------------------------------------------------------------------------
-- safety_exclusion — SPEC-001 FR-20 / SPEC-003 FR-20.
-- A first-class audit record, NOT a log line. A log line is lost on rotation;
-- the decision "we refused to sell this" must remain answerable.
-- ---------------------------------------------------------------------------
CREATE TABLE safety_exclusion (
  exclusion_id       @{UUID} PRIMARY KEY,
  run_id             @{UUID} NOT NULL REFERENCES ingestion_run(run_id),
  network_id         @{TEXT} NOT NULL REFERENCES network(network_id),
  external_product_id @{TEXT} NOT NULL,
  matched_category   @{TEXT} NOT NULL,
  matched_keyword    @{TEXT} NOT NULL,
  title              @{TEXT},
  excluded_at        @{TIMESTAMP} NOT NULL
);

CREATE INDEX idx_safety_exclusion_run ON safety_exclusion(run_id);

-- ---------------------------------------------------------------------------
-- click_event — SPEC-005 §2.3.
--
-- `channel` is NOT NULL (FR-9): without it, EPC per channel is uncomputable
-- and the whole business cannot be evaluated. That is roadmap gap M1 / issue #2.
--
-- visitor_hash is a SALTED hash. Raw IPs are never stored (FR-10, NFR-5).
-- ---------------------------------------------------------------------------
CREATE TABLE click_event (
  click_id             @{UUID} PRIMARY KEY,
  product_id           @{UUID} NOT NULL REFERENCES product(product_id),
  network_id           @{TEXT} NOT NULL REFERENCES network(network_id),
  destination_country  @{TEXT},
  channel              @{TEXT} NOT NULL,
  clicked_at           @{TIMESTAMP} NOT NULL,
  visitor_hash         @{TEXT} NOT NULL,
  -- Own-click fraud detection (SPEC-005 FR-20, AC-20).
  self_referred        @{BOOLEAN} NOT NULL DEFAULT 0,
  -- Cookie-window end. Our attribution window must match the network's
  -- exactly, never exceed it (SPEC-005 NFR-3).
  attribution_expires_at @{TIMESTAMP} NOT NULL
);

CREATE INDEX idx_click_product ON click_event(product_id, clicked_at DESC);
CREATE INDEX idx_click_channel ON click_event(channel, clicked_at);
CREATE INDEX idx_click_open    ON click_event(attribution_expires_at)
  WHERE self_referred = 0;

-- ---------------------------------------------------------------------------
-- conversion_event — SPEC-005 §2.4.
--
-- SPEC-013/FR-13: OUR attribution and the NETWORK's report are stored
-- separately and never silently reconciled. The delta between them is the
-- fraud and misattribution signal, so collapsing them would destroy the only
-- evidence that something is wrong.
--
-- click_id NULL = network reported a sale we have no click for (SPEC-005 EC-5).
-- Recording that as ours would inflate our numbers.
-- ---------------------------------------------------------------------------
CREATE TABLE conversion_event (
  conversion_id       @{UUID} PRIMARY KEY,
  network_id          @{TEXT} NOT NULL REFERENCES network(network_id),
  -- Idempotency key: a duplicate network report must not double-count (EC-12).
  external_order_id   @{TEXT} NOT NULL,
  click_id            @{UUID} REFERENCES click_event(click_id),
  status              @{TEXT} NOT NULL
                      CHECK (status IN ('pending','converted','refunded','overdue','unattributed')),
  amount_minor        @{MONEY} NOT NULL,
  currency            @{TEXT} NOT NULL CHECK (length(currency) = 3),
  reported_at         @{TIMESTAMP} NOT NULL,
  -- B2B pays only at TradeCompleted (verified) — SPEC-005 FR-16.
  trade_completed_at  @{TIMESTAMP},
  paid_at             @{TIMESTAMP},
  -- Verified B2B rule: paid -> completed must be < 180 days, else the order
  -- does not qualify for commission (SPEC-005 EC-13).
  qualifies_b2b_window @{BOOLEAN} NOT NULL DEFAULT 1,
  UNIQUE (network_id, external_order_id)
);

CREATE INDEX idx_conversion_click ON conversion_event(click_id);
CREATE INDEX idx_conversion_status ON conversion_event(status, reported_at DESC);

-- ---------------------------------------------------------------------------
-- commission_record — SPEC-005 FR-15/FR-16.
--
-- commission_rate_applied is FROZEN at conversion time (SPEC-005 EC-7):
-- repricing historical clicks at a new rate would silently rewrite history.
-- ---------------------------------------------------------------------------
CREATE TABLE commission_record (
  record_id              @{UUID} PRIMARY KEY,
  conversion_id          @{UUID} NOT NULL REFERENCES conversion_event(conversion_id),
  amount_minor           @{MONEY} NOT NULL,
  currency               @{TEXT} NOT NULL CHECK (length(currency) = 3),
  status                 @{TEXT} NOT NULL CHECK (status IN ('pending','earned','clawed_back')),
  commission_rate_applied @{RATE} NOT NULL
                           CHECK (commission_rate_applied >= 0 AND commission_rate_applied <= 1),
  requires_trade_completed @{BOOLEAN} NOT NULL DEFAULT 0,
  reported_at            @{TIMESTAMP} NOT NULL,
  paid_out_at            @{TIMESTAMP},
  UNIQUE (conversion_id)
);

-- ---------------------------------------------------------------------------
-- Ingestion support (SPEC-001 §7).
-- ---------------------------------------------------------------------------

-- SPEC-001 FR-15: dead-letter with enough context to replay it (NFR-7).
CREATE TABLE dead_letter (
  id           @{UUID} PRIMARY KEY,
  run_id       @{UUID} NOT NULL REFERENCES ingestion_run(run_id),
  module_id    @{TEXT} NOT NULL,
  entity_ref   @{TEXT},
  error_code   @{TEXT} NOT NULL,
  error_class  @{TEXT} NOT NULL,
  payload_hash @{TEXT} NOT NULL,
  payload      @{JSON} NOT NULL,
  attempts     @{INT} NOT NULL DEFAULT 0,
  replayed_at  @{TIMESTAMP}
);

CREATE INDEX idx_dead_letter_pending ON dead_letter(run_id) WHERE replayed_at IS NULL;

-- SPEC-001 FR-14: daily request budget. Exhausting it must stop cleanly rather
-- than risk being blocked (no sandbox exists on AliExpress).
CREATE TABLE request_ledger (
  module_id       @{TEXT} NOT NULL,
  day             @{TEXT} NOT NULL,
  requests_spent  @{INT} NOT NULL DEFAULT 0,
  budget          @{INT} NOT NULL CHECK (budget > 0),
  PRIMARY KEY (module_id, day)
);

-- SPEC-001 FR-10: resumable ingestion.
CREATE TABLE ingestion_checkpoint (
  module_id      @{TEXT} PRIMARY KEY,
  cursor         @{JSON},
  rows_committed @{INT} NOT NULL DEFAULT 0,
  updated_at     @{TIMESTAMP} NOT NULL
);

-- ---------------------------------------------------------------------------
-- SPEC-002 §8 — fingerprinting tables for cross-listing matching.
-- ---------------------------------------------------------------------------

-- Computed from image CONTENT, never the URL (SPEC-002 EC-6): a changed CDN
-- URL for an identical image must still match.
CREATE TABLE image_fingerprint (
  product_id            @{UUID} PRIMARY KEY REFERENCES product(product_id),
  -- 64-bit perceptual hash, hex encoded.
  phash_64              @{TEXT} NOT NULL,
  -- EC-10: sellers often reuse one photo; record how many distinct images exist.
  distinct_image_count  @{INT} NOT NULL DEFAULT 1,
  computed_at           @{TIMESTAMP} NOT NULL
);

CREATE TABLE title_normalised (
  product_id @{UUID} PRIMARY KEY REFERENCES product(product_id),
  language   @{TEXT} NOT NULL,
  normalised @{TEXT} NOT NULL,
  tokens     @{JSON} NOT NULL
);

CREATE INDEX idx_title_tokens ON title_normalised(normalised);

-- SPEC-002 FR-4: variant groups are scoped WITHIN a network. Amazon's verified
-- GetVariations gives a network-native grouping we prefer over our heuristic
-- (FR-5), and the `source` column records which produced it.
CREATE TABLE product_variant_group (
  group_id      @{UUID} PRIMARY KEY,
  network_id    @{TEXT} NOT NULL REFERENCES network(network_id),
  source        @{TEXT} NOT NULL CHECK (source IN ('network_native','heuristic')),
  variant_axis  @{TEXT},
  created_at    @{TIMESTAMP} NOT NULL
);

CREATE TABLE product_variant_member (
  group_id    @{UUID} NOT NULL REFERENCES product_variant_group(group_id),
  product_id  @{UUID} NOT NULL REFERENCES product(product_id),
  PRIMARY KEY (group_id, product_id)
);

-- SPEC-002 FR-10: the baseline measurement. Precision/recall are TARGETS until
-- this table holds a real run against a hand-labelled sample.
CREATE TABLE match_evaluation (
  evaluation_id      @{UUID} PRIMARY KEY,
  run_at             @{TIMESTAMP} NOT NULL,
  sample_size        @{INT} NOT NULL,
  -- The composition matters: a number without its sample is not evidence.
  sample_composition @{JSON} NOT NULL,
  recall             @{RATE} NOT NULL,
  precision          @{RATE} NOT NULL,
  weights_used       @{JSON} NOT NULL,
  notes              @{TEXT}
);
