-- SPEC-003 §6 — pricing. This is the core of the product.
--
-- KEY DESIGN POINT (decision D-028): price is keyed
-- (product, destination_country, observed_at) because the verified
-- `ship_to_country` parameter returns "the corresponding product price
-- according to that country's tax policy". Price is therefore a FUNCTION of
-- product AND destination, not a scalar. A single price column cannot
-- represent the platform's semantics and would silently discard the data that
-- landed cost depends on.

-- ---------------------------------------------------------------------------
-- price_observation — raw observations.
--
-- FR-9: unknown is NULL, never 0. `is_complete` marks a total that must not be
-- presented as final. The honesty requirement is enforced HERE, in the data
-- layer, so no renderer can bypass it by forgetting.
-- ---------------------------------------------------------------------------
CREATE TABLE price_observation (
  observation_id        @{UUID} PRIMARY KEY,
  product_id            @{UUID} NOT NULL REFERENCES product(product_id),
  -- ISO-3166 alpha-2. Canonical form only (SPEC-003 EC-14).
  destination_country   @{TEXT} NOT NULL CHECK (length(destination_country) = 2),
  observed_at           @{TIMESTAMP} NOT NULL,
  -- ISO-4217, always present (FR-8). Prices in different currencies are never
  -- compared or averaged directly (SPEC-003 AC-9).
  currency              @{TEXT} NOT NULL CHECK (length(currency) = 3),
  sale_price_minor      @{MONEY} NOT NULL CHECK (sale_price_minor >= 0),
  original_price_minor  @{MONEY},
  commission_rate       @{RATE} CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1)),
  -- Verified API parameter `delivery_days` (FR-10).
  delivery_bucket_days  @{INT} CHECK (delivery_bucket_days IS NULL OR delivery_bucket_days > 0),
  -- NULL means UNKNOWN. Never 0, and never a value inherited from another
  -- destination (SPEC-003 EC-5, AC-8).
  shipping_minor        @{MONEY},
  duty_minor            @{MONEY},
  -- false when any cost component above is unknown. A total computed from this
  -- row MUST be marked incomplete when surfaced.
  is_complete           @{BOOLEAN} NOT NULL DEFAULT 1,
  source                @{TEXT} NOT NULL CHECK (source IN ('csv','api','manual')),
  source_run_id         @{UUID} REFERENCES ingestion_run(run_id),
  -- EC-2: original < sale means an upstream anomaly and an unreliable discount.
  -- Stored AS-IS and flagged, never silently corrected — this is a primary
  -- input to fake-discount detection.
  price_anomaly         @{TEXT} CHECK (price_anomaly IS NULL OR price_anomaly IN ('original_lt_sale','sale_zero')),
  UNIQUE (product_id, destination_country, observed_at)
);

-- Serves NFR-2: price-series query for one product + one destination.
CREATE INDEX idx_price_series
  ON price_observation(product_id, destination_country, observed_at DESC);
-- Serves retention sweeps (FR-16/FR-17) without scanning the whole table.
CREATE INDEX idx_price_observed_at ON price_observation(observed_at);

-- ---------------------------------------------------------------------------
-- price_daily_rollup — survives raw-data deletion.
--
-- FR-18: deleting raw high-resolution data MUST NOT lose the ability to answer
-- "what was the price a year ago" — that ability IS the product. The retention
-- job rolls up to this table before deleting from price_observation.
-- ---------------------------------------------------------------------------
CREATE TABLE price_daily_rollup (
  product_id          @{UUID} NOT NULL REFERENCES product(product_id),
  destination_country @{TEXT} NOT NULL,
  day                 @{TEXT} NOT NULL,
  currency            @{TEXT} NOT NULL CHECK (length(currency) = 3),
  min_price_minor     @{MONEY} NOT NULL,
  max_price_minor     @{MONEY} NOT NULL,
  -- Rounded half-up. Documented rather than hidden: this is the only derived
  -- money value in the schema, so its rounding rule must be explicit.
  avg_price_minor     @{MONEY} NOT NULL,
  first_price_minor   @{MONEY} NOT NULL,
  last_price_minor    @{MONEY} NOT NULL,
  observations        @{INT} NOT NULL CHECK (observations > 0),
  computed_at         @{TIMESTAMP} NOT NULL,
  PRIMARY KEY (product_id, destination_country, day)
);

-- ---------------------------------------------------------------------------
-- product_identity_match — cross-listing CANDIDATES.
--
-- SPEC-003 FR-5/FR-6, decision D-027: never merged into `product`. Merging
-- destroys per-network attribution needed for commission reconciliation, and is
-- practically irreversible.
-- ---------------------------------------------------------------------------
CREATE TABLE product_identity_match (
  match_id       @{UUID} PRIMARY KEY,
  product_id_a   @{UUID} NOT NULL REFERENCES product(product_id),
  product_id_b   @{UUID} NOT NULL REFERENCES product(product_id),
  -- A SIMILARITY SCORE, not a calibrated probability (SPEC-002 FR-11).
  confidence     @{RATE} NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  method         @{TEXT} NOT NULL
                 CHECK (method IN ('image_hash','title_norm','gtin','network_variant','manual')),
  -- The firing signals and their individual scores (SPEC-002 FR-9). A bare
  -- confidence number is not auditable, so this is NOT NULL.
  signals        @{JSON} NOT NULL,
  -- NULL reviewed_at = unreviewed candidate.
  reviewed_at    @{TIMESTAMP},
  review_outcome @{TEXT} CHECK (review_outcome IS NULL OR review_outcome IN ('confirmed','rejected')),
  created_at     @{TIMESTAMP} NOT NULL,
  -- Normalised so (a,b) and (b,a) cannot both exist.
  CHECK (product_id_a < product_id_b)
);

CREATE UNIQUE INDEX idx_identity_pair
  ON product_identity_match(product_id_a, product_id_b);
CREATE INDEX idx_identity_unreviewed
  ON product_identity_match(created_at) WHERE reviewed_at IS NULL;
