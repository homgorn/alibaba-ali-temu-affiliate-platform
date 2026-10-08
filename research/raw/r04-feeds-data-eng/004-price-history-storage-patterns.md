# PostgreSQL Partitioning and Data Retention

**URL:** https://www.postgresql.org/docs/current/ddl-partitioning.html
**Publisher:** PostgreSQL Global Development Group
**Publish Date:** 2026-09-24 (PostgreSQL 18.6 docs)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Partitioning refers to splitting what is logically one large table into smaller physical pieces. Partitioning can provide several benefits:
> - Query performance can be improved dramatically in certain situations, particularly when most of the heavily accessed rows of the table are in a single partition or a small number of partitions.
> - When queries or updates access a large percentage of a single partition, performance can be improved by using a sequential scan of that partition instead of using an index.
> - Bulk loads and deletes can be accomplished by adding or removing partitions, if the usage pattern is accounted for in the partitioning design. Dropping an individual partition using DROP TABLE, or doing ALTER TABLE DETACH PARTITION, is far faster than a bulk operation. These commands also entirely avoid the VACUUM overhead caused by a bulk DELETE.
> - Seldom-used data can be migrated to cheaper and slower storage media.

> These benefits will normally be worthwhile only when a table would otherwise be very large. The exact point at which a table will benefit from partitioning depends on the application, although a rule of thumb is that the size of the table should exceed the physical memory of the database server."

> "PostgreSQL offers built-in support for the following forms of partitioning:
> **Range Partitioning**: The table is partitioned into 'ranges' defined by a key column or set of columns, with no overlap between the ranges of values assigned to different partitions.
> **List Partitioning**: The table is partitioned by explicitly listing which key value(s) appear in each partition.
> **Hash Partitioning**: The table is partitioned by specifying a modulus and a remainder for each partition."

> "To create a unique or primary key constraint on a partitioned table, the partition keys must not include any expressions or function calls and the constraint's columns must include all of the partition key columns."

---

# pg_partman Auto-archiving and Data Retention

**URL:** https://www.crunchydata.com/blog/auto-archiving-and-data-retention-management-in-postgres-with-pg_partman
**Publisher:** Crunchy Data
**Publish Date:** 2024-04-19 (updated 2026-08-18)
**Access Date:** 2026-10-08

## Verbatim Quotes

> "You could be saving money every month on databases costs with a smarter data retention policy. One of the primary reasons, and a huge benefit of partitioning is using it to automatically archive your data. For example, you might have a huge log table. For business purposes, you need to keep this data for 30 days. This table grows continually over time and keeping all the data makes database maintenance challenging. With time-based partitioning, you can simply archive off data older than 30 days."

> "The nature of most relational databases means that deleting large volumes of data can be very inefficient and that space is not immediately, if ever, returned to the file system. PostgreSQL does not return the space it reserves to the file system when normal deletion operations are run except under very specific conditions:
> 1. the page(s) at the end of the relation are completely emptied
> 2. a VACUUM FULL/CLUSTER is run against the relation (exclusively locking it until complete)
> If you find yourself needing that space back more immediately, or without intrusive locking, then partitioning can provide a much simpler means of removing old data: drop the table. The removal is nearly instantaneous (barring any transactions locking the table) and immediately returns the space to the file system."

> "In pg_partman, retention management is handled at the same time as new partition creation. So a simple call to run_maintenance_proc() will handle both."

> "UPDATE partman.part_config SET retention = '2 days', premake = 6 WHERE parent_table = 'public.time_stuff';"

> "You can also tell partman to move the old tables to a different schema as part of the retention maintenance option. And lastly, there is a Python script available to dump out any tables in a given schema to compressed, checksummed files using pg_dump."

---

# Slowly Changing Dimensions in Postgres (Price History Patterns)

**URL:** https://marclinster.medium.com/slowly-changing-dimensions-in-postgres-7d0f4cac2191
**Publisher:** Marc Linster / Medium
**Publish Date:** 2025-07-03
**Access Date:** 2026-10-08

## Verbatim Quotes

> "For instance, price lists frequently change, and tracking these historical changes is essential for analytics and transactions. With SCDs, we can determine which price was in effect at any given time, allowing us to analyze how price adjustments impact revenue trends."

> "Type 4 creates a history table to track an infinite number of historical changes. The current price and the historical prices are kept in the same table. The current price is the price with the most current effective date.
> CREATE TABLE product_price_type_4 (
> product_id INTEGER,
> price NUMERIC,
> effective_date date,
> PRIMARY KEY (product_id, effective_date)
> );"

> "Type 6 combines Type 1, 2, and 3 into a single history table that has start and end dates for the change and a flag to indicate which record represents the current value.
> CREATE TABLE product_price_type_6 (
> product_id INTEGER,
> price NUMERIC,
> start_date date,
> end_date date,
> current BOOLEAN,
> );"

> "Postgres Common Table Expressions (CTE) and window functions help us identify gaps in the date ranges.
> CREATE EXTENSION IF NOT EXISTS btree_gist;
> CREATE TABLE product_price_scd (
> id UUID PRIMARY KEY,
> product_id INTEGER NOT NULL,
> price NUMERIC DEFAULT 0 NOT NULL,
> validity DATERANGE,
> )"

---

# Database Partitioning Benchmarks

**URL:** https://medium.com/@amdadulgfx/database-partitioning-in-postgresql-performance-gains-trade-offs-and-real-benchmarks-a40834c830cc
**Publisher:** Medium / Amdadul Haq Arif
**Publish Date:** 2026-05-23
**Access Date:** 2026-10-08

## Verbatim Quotes

> "Partitioning simplifies data retention. Instead of running expensive DELETE operations that bloat transaction logs and fragment indexes, administrators can simply drop an entire partition (e.g., deleting 'January 2024' data)."

> "The claims above aren't theoretical; here's the evidence from a reproducible PostgreSQL benchmark comparing a 3-million-row monolithic table against a yearly-partitioned table."

> "The key insight: Partitioning without appropriate per-partition indexes can significantly degrade query performance for indexed lookup patterns."

> "Index Constraints: In many relational systems, unique constraints and primary keys must include the partition key. This can complicate schema designs that rely on global UUIDs.

> Cross-Partition Queries: If a query doesn't use the partition key, the engine must perform a 'scatter-gather' operation, searching every partition. This can be slower than a non-partitioned table."