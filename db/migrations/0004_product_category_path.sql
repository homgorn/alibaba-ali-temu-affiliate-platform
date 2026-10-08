-- Add a denormalised category path so the lookup API can filter by any node of
-- the taxonomy (a leaf match like "Dresses" should also surface when the user
-- asks for "Womens Clothing & Accessories"). Keeping it as text mirrors the
-- denormalised shape the feed provides via `category_path`.
--
-- SQLite and Postgres both support ADD COLUMN with a constant/NULL default, so
-- this stays a single portable migration (SPEC-003 FR-1).

ALTER TABLE product ADD COLUMN category_path @{TEXT};
