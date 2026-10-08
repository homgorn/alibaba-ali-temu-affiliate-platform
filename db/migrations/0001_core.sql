-- SPEC-003 §6 — core catalogue tables.
--
-- Portability: logical type tokens (@{...}) are substituted per engine by
-- src/engine/db/migrate.ts. Engine-specific behaviour uses @if/@else markers.
--
-- Money is @{MONEY} (integer minor units) in BOTH engines — SPEC-003 FR-3.
-- Never float: this product is a price computation.

-- ---------------------------------------------------------------------------
-- network — a source platform. Never assume single-network (SPEC-003 FR-22).
-- ---------------------------------------------------------------------------
CREATE TABLE network (
  network_id            @{TEXT} PRIMARY KEY,
  display_name          @{TEXT} NOT NULL,
  source_kind           @{TEXT} NOT NULL
                        CHECK (source_kind IN ('live-api','file-csv','manual-curated')),
  commission_model      @{TEXT} NOT NULL
                        CHECK (commission_model IN ('cps','cpa','cpi','report-only')),
  -- Verified: AliExpress cookie window is 3 days. Networks without a fixed
  -- window leave this NULL rather than guessing.
  cookie_window_days    @{INT},
  supports_product_feed @{BOOLEAN} NOT NULL DEFAULT 0,
  supports_deep_links   @{BOOLEAN} NOT NULL DEFAULT 0,
  enabled               @{BOOLEAN} NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- retention_policy — CONFIGURATION, not code (SPEC-003 FR-15).
-- Retention can be tightened later without a migration.
-- ---------------------------------------------------------------------------
CREATE TABLE retention_policy (
  table_name      @{TEXT} PRIMARY KEY,
  retention_class @{TEXT} NOT NULL,
  max_age_days    @{INT} NOT NULL CHECK (max_age_days > 0),
  basis           @{TEXT} NOT NULL
                 CHECK (basis IN ('tos-permitted','derived-aggregate','operator-review')),
  -- Required when basis='tos-permitted': cite the clause. Prevents a policy
  -- with no evidential basis from masquerading as compliant.
  tos_reference   @{TEXT},
  -- Where to roll up before deleting, so history survives raw deletion (FR-18).
  rollup_to       @{TEXT},
  CHECK (basis <> 'tos-permitted' OR tos_reference IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- ingestion_run — provenance for every write (SPEC-001 FR-17, SPEC-003 FR-19).
-- Created before `product` because product FKs reference it.
-- ---------------------------------------------------------------------------
CREATE TABLE ingestion_run (
  run_id                 @{UUID} PRIMARY KEY,
  module_id              @{TEXT} NOT NULL,
  network_id             @{TEXT} NOT NULL REFERENCES network(network_id),
  source_kind            @{TEXT} NOT NULL
                         CHECK (source_kind IN ('live-api','file-csv','manual-curated')),
  started_at             @{TIMESTAMP} NOT NULL,
  finished_at            @{TIMESTAMP},
  rows_read              @{INT} NOT NULL DEFAULT 0,
  rows_written           @{INT} NOT NULL DEFAULT 0,
  rows_skipped           @{INT} NOT NULL DEFAULT 0,
  rows_excluded_safety   @{INT} NOT NULL DEFAULT 0,
  dead_lettered          @{INT} NOT NULL DEFAULT 0,
  requests_spent         @{INT} NOT NULL DEFAULT 0,
  outcome                @{TEXT} NOT NULL DEFAULT 'running'
                         CHECK (outcome IN ('running','success','partial','failed','budget-exhausted'))
);

CREATE INDEX idx_ingestion_run_network ON ingestion_run(network_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- module — registered integration (SPEC-001 FR-1, EC-9, EC-12).
-- ---------------------------------------------------------------------------
CREATE TABLE module (
  module_id             @{TEXT} PRIMARY KEY,
  network_id            @{TEXT} NOT NULL UNIQUE REFERENCES network(network_id),
  source_kind           @{TEXT} NOT NULL,
  capabilities          @{JSON} NOT NULL,
  -- EC-9: a module without a retention class must be rejected at registration,
  -- not at first write. The FK makes this structural.
  retention_class       @{TEXT} NOT NULL,
  requests_per_day      @{INT},
  identifier_strategy   @{TEXT} NOT NULL,
  enabled               @{BOOLEAN} NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- category — first/second level taxonomy (verified API fields).
-- ---------------------------------------------------------------------------
CREATE TABLE category (
  category_id        @{UUID} PRIMARY KEY,
  network_id         @{TEXT} NOT NULL REFERENCES network(network_id),
  external_id        @{TEXT} NOT NULL,
  parent_external_id @{TEXT},
  level              @{INT} NOT NULL CHECK (level IN (1, 2)),
  name_en            @{TEXT} NOT NULL,
  name_localised     @{JSON},
  -- D-012: safety-critical categories are excluded at ingest (SPEC-001 FR-20).
  is_safety_critical @{BOOLEAN} NOT NULL DEFAULT 0,
  UNIQUE (network_id, external_id, level)
);

-- ---------------------------------------------------------------------------
-- product — the catalogue row.
-- Unique key is the ingest key (SPEC-003 FR-4, AC-5).
-- ---------------------------------------------------------------------------
CREATE TABLE product (
  product_id            @{UUID} PRIMARY KEY,
  network_id            @{TEXT} NOT NULL REFERENCES network(network_id),
  external_product_id   @{TEXT} NOT NULL,
  shop_external_id      @{TEXT},
  title                 @{TEXT} NOT NULL,
  title_localised       @{JSON},
  detail_url            @{TEXT} NOT NULL,
  category_id           @{UUID} REFERENCES category(category_id),
  image_url             @{TEXT},
  image_urls            @{JSON},
  video_url             @{TEXT},
  platform_product_type @{TEXT},
  evaluate_rate         @{RATE},
  lastest_volume        @{INT},
  -- FR-13: NULL commission => monetisable=false. A product we cannot earn on
  -- is dead weight, so this is set at ingest rather than inferred at query time.
  commission_rate       @{RATE} CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 1)),
  monetisable           @{BOOLEAN} NOT NULL DEFAULT 0,
  safety_excluded       @{BOOLEAN} NOT NULL DEFAULT 0,
  first_seen_at         @{TIMESTAMP} NOT NULL,
  last_seen_at          @{TIMESTAMP} NOT NULL,
  source                @{TEXT} NOT NULL CHECK (source IN ('csv','api','manual')),
  source_run_id         @{UUID} REFERENCES ingestion_run(run_id),
  -- EC-8: price 0 is an upstream placeholder, not a price. Flagged, not deleted,
  -- so the exclusion is auditable.
  price_is_placeholder  @{BOOLEAN} NOT NULL DEFAULT 0,
  UNIQUE (network_id, external_product_id)
);

CREATE INDEX idx_product_network   ON product(network_id);
CREATE INDEX idx_product_category  ON product(category_id);
-- Supports the monetised-listing query (SPEC-003 AC-11).
CREATE INDEX idx_product_monetise  ON product(network_id, monetisable, safety_excluded);
