-- Ensure historical_prices has one row per (symbol, interval, timestamp)
-- 1) remove duplicates while preserving the earliest row per key
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY symbol, interval, "timestamp"
      ORDER BY id ASC
    ) AS rn
  FROM historical_prices
)
DELETE FROM historical_prices hp
USING ranked r
WHERE hp.id = r.id
  AND r.rn > 1;

-- 2) enforce uniqueness moving forward
CREATE UNIQUE INDEX IF NOT EXISTS historical_prices_symbol_interval_timestamp_uniq
  ON historical_prices(symbol, interval, "timestamp");
