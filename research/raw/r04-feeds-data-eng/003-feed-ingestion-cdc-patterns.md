# CDC and Feed Ingestion Architecture Patterns

**URL:** https://docs.airbyte.com/platform/understanding-airbyte/cdc
**Publisher:** Airbyte
**Publish Date:** 2026 (active)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "What is log-based incremental replication?
> The orchestration for syncing is similar to non-CDC database sources. After selecting a sync interval, syncs are launched regularly. We read data from the previously synced position in the logs up to the start time of the sync. We do not treat CDC sources as infinite streaming sources."

> "You should ensure that your schedule for running these syncs is frequent enough to consume the logs that are generated. The first time the sync is run, a snapshot of the current state of the data will be taken. This snapshot is created with a SELECT statement and is effectively a Full Refresh (meaning changes won't be logged)."

> "Subsequent syncs will use the logs to determine which changes took place since the last sync and update those. Airbyte keeps track of the current log position between syncs."

> "Limitations
> * CDC incremental is only supported for tables with primary keys for most sources.
> * Data must be in tables, not views.
> * The modifications you are trying to capture must be made using DELETE / INSERT / UPDATE. For example, changes made from TRUNCATE / ALTER won't appear in logs and therefore in your destination."

> "Adding New Schemas/Columns
> When using CDC, each schema included in the sync will first undergo an initial snapshot (equivalent to a full refresh).
> If you create a new schema/column that is not yet being synced, it must first be snapshotted before CDC can begin tracking changes."

---

# Supporting Very Large CDC Syncs with WASS (Airbyte)

**URL:** https://airbyte.com/blog/supporting-very-large-cdc-syncs-with-wass
**Publisher:** Airbyte
**Publish Date:** 2026-06-29
**Access Date:** 2026-10-08

## Verbatim Quotes

> "CDC typically reads off of a database's transaction log (WAL in postgres, binlog in MySQL, oplog in MongoDB, Transaction Logs in SQL Server). These changelogs have a retention period associated with them (e.g. last day, last week) and do not contain the full history of changes in a database. Consequently, during an initial sync Airbyte is required to perform a snapshot of the full underlying database table before it can start streaming incremental changes off of the transaction log."

> "How Airbyte supports large incremental CDC syncs
> 1. Start the initial snapshot for configured tables. This involves issuing a series of SQL queries to the underlying database to sync data in small chunks in a way that is efficient, resumable, and unobtrusive.
> 2. Ensuring data correctness
> While implementing any changes to our core algorithms, we wanted to make sure that there were no data loss scenarios added. Airbyte's at-least once delivery allows for some duplicate records to be emitted but guarantees that there will be no data loss.
> We run CDC for streams that have started or completed snapshotting.
> 1. A change on the transaction log corresponds to a record that was already processed by the initial snapshot. This is a change that could not yet be reflected in the initial snapshot. This change must be emitted to ensure that there is no data loss."

---

# CDC Pipeline Architecture (SeaTunnel)

**URL:** https://github.com/apache/seatunnel/blob/dev/docs/en/architecture/cdc-pipeline-architecture.md
**Publisher:** Apache SeaTunnel
**Publish Date:** 2026 (active dev branch)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "A CDC job is still a normal SeaTunnel job: Source -> Transform -> Sink
> The difference is that the source emits change events instead of only append-only rows. A CDC pipeline usually has these characteristics:
> * the source starts with a snapshot or other bootstrap phase
> * the source then switches to incremental log reading
> * rows carry row kind and source metadata
> * the pipeline may propagate schema changes
> * the sink must decide how to apply insert, update, and delete events"

> "Snapshot + Incremental Reading
> Most relational CDC connectors do not start directly from the changelog stream. They first need a consistent snapshot of existing data, then continue with incremental changes.
> The common pattern is:
> 1. split large tables into snapshot chunks
> 2. assign those chunks to parallel readers
> 3. track a handoff point between snapshot and incremental reading
> 4. continue from the database log or change stream"

> "Sink Application
> The sink decides how to materialize change events. Common patterns are:
> * append-only write after converting CDC events upstream
> * key-based upsert
> * delete propagation
> * two-phase commit or idempotent commit for exactly-once style delivery"

> "Checkpoint and Recovery
> Checkpoint is critical for CDC because the system must recover both..."

---

# Debezium + Flink + Iceberg CDC Pipeline

**URL:** https://github.com/tejaswini-keerthi/cdc-pipeline
**Publisher:** GitHub (tejaswini-keerthi)
**Publish Date:** 2026 (active)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "A fully containerized Change Data Capture pipeline that streams every row-level INSERT, UPDATE, and DELETE from PostgreSQL into Apache Iceberg with exactly-once delivery, sub-3-second replication latency, primary-key deduplication, a dead-letter queue, and a full Prometheus + Grafana observability stack."

> "Key Features
> Log-Based Change Data Capture: Debezium reads PostgreSQL's Write-Ahead Log directly via the pgoutput plugin — zero load on the source database, no polling lag, and captures every INSERT, UPDATE, and DELETE as a structured Kafka event with before/after images.

> Exactly-Once Delivery: Flink checkpoints every 10 seconds in EXACTLY_ONCE mode. The Iceberg sink commits one snapshot per completed checkpoint as an atomic JDBC catalog transaction, with the checkpoint ID stored in snapshot metadata — replayed checkpoints never double-commit.

> Primary-Key Fingerprinting and Deduplication: Sources are decoded as Debezium changelog streams with PRIMARY KEY ... NOT ENFORCED, producing idempotent PK-keyed upserts. pk_fingerprint (MD5 of primary key) is the stable dedup key; content_fingerprint (MD5 of business columns) enables no-op-update detection.

> Schema Evolution Without Downtime: Debezium emits new and changed columns automatically as the PostgreSQL schema changes. Iceberg v2 supports column add, drop, and rename without rewriting existing data files — schema changes propagate with no connector restart required.

> Dead Letter Queue and Alerting: Malformed events are skipped by Flink (ignore-parse-errors) so the job never crashes, and simultaneously captured by the DLQ router which routes them to dlq.inventory with error-reason headers."

---

# Data Pipeline Design Patterns

**URL:** https://dataskew.io/blog/data-pipeline-design-patterns
**Publisher:** DataSkew
**Publish Date:** 2024-2025
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Data Pipeline Design Patterns: Idempotency, DLQ, CDC and 5...
> 8 production-grade pipeline patterns explained with Python and SQL: idempotency, backfilling, dead letter queues, CDC, schema evolution. The patterns that keep ETL running at 3 AM without paging you."

---

# Stripe SFTP Catalog Ingestion (Hybrid Feed Model)

**URL:** https://docs.stripe.com/agentic-commerce/product-feed/sftp-catalog-ingestion
**Publisher:** Stripe
**Publish Date:** 2026 (active)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Hybrid feed model
> Stripe delivers data in two distinct streams to make efficient use of bandwidth and processing.
> * Feed | Frequency | Primary purpose | File name pattern
> * Product Master Feed | Every 24 hours | Stable metadata: descriptions, images, brand, and taxonomy | full_catalog_part_[N]_of_[Total].csv.gz
> * Delta Feed (opt-in) | Hourly | Real-time price, sale price, availability, and inventory changes | delta_part_[N]_of_[Total].csv.gz"

> "For catalogs larger than 100,000 rows, Stripe might split the data into multiple shard files. Stripe uploads manifest.json last. Treat it as the signal that the batch is complete and ready to ingest. Don't begin ingestion until manifest.json is present."

> "Synchronization rules
> The contents of the SFTP directory are the current source of truth.
> How Stripe delivers data
> Use the following delivery behaviors to design your ingestion process.
> * Stripe overwrites the contents of catalog and updates each cycle. The SFTP directory always reflects the latest batch. Stripe doesn't retain prior batches.
> * Stripe uploads data files first and uploads manifest.json last so you don't ingest a partial batch."

---

# Affiliate Feed Aggregation (Affiliate.com)

**URL:** https://blog.affiliate.com/affiliate-product-feed-aggregator-how-to-consolidate-multiple-network-feeds-into-one-api
**Publisher:** Affiliate.com
**Publish Date:** 2026-05-21
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Affiliate.com aggregates normalized product data across more than 30 networks, tens of thousands of merchant programs, and over a billion products, with searchable fields for merchant, brand, barcode, SKU, MPN, ASIN, price, discount, availability, currency, attributes, URLs, and network metadata."

> "Why consolidating affiliate feeds is harder than combining files
> A merchant feed is not a universal product catalog. It is a merchant supplied view of inventory, often shaped by that merchant's ecommerce system, network requirements, taxonomy habits, and promotional priorities.
> The same product may appear as three different titles across three merchants. One feed may include a GTIN."

> "Normalization means standardizing inconsistent product data so different feeds can be searched, compared, and organized through common fields. In affiliate product data, normalization touches brand names, product titles, identifiers, categories, pricing fields, availability states, and merchant metadata."

---

# Coupon Feed Normalization (Feedico)

**URL:** https://dev.to/feedico_8c6c4565ff094c285/how-i-normalized-74000-scattered-coupon-feeds-into-a-single-real-time-api-and-built-a-live-img
**Publisher:** DEV Community / Feedico
**Publish Date:** 2026-06-12
**Access Date:** 2026-10-08

## Verbatim Quotes

> "If your database can't handle this normalization dynamically, your frontend will either render broken links or stale data.
> The Architecture: How It Works I wanted the engine to be ridiculously fast. We currently track 41,452 unique merchants and over 74,296 active coupon codes."

> "The Ingestion Layer: A fleet of cron jobs (Node.js/TypeScript) fetches raw data from master affiliate APIs at staggered intervals to prevent rate-limiting.

> The Normalization Pipeline: Every raw coupon object passes through a strict validation schema. Names are slugified, dates are unified to a standard ISO format, and expired tokens are instantly flagged.

> The Storage Strategy: Instead of blasting heavy relational JOIN queries every time a user types a word, everything is indexed efficiently so it handles full-text search instantly."