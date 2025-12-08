-- init.sql
CREATE DATABASE perfdb;

\c perfdb

CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  product_name TEXT,
  category_id INT,
  amount DECIMAL(10,2)
);

-- Generate 1M rows (fast for demo, scale to 5M later)
INSERT INTO sales (product_name, category_id, amount)
SELECT
  'Product ' || (random() * 100000)::int,
  (random() * 50)::int + 1,
  random() * 1000
FROM generate_series(1, 1000000);

-- Index for optimized query
CREATE INDEX idx_sales_category ON sales(category_id);

-- Materialized View for ultra-fast summary
CREATE MATERIALIZED VIEW mv_sales_summary AS
SELECT 
  CASE 
    WHEN category_id = 1 THEN 'Electronics'
    WHEN category_id = 2 THEN 'Clothing'
    ELSE 'Other'
  END AS category,
  COUNT(*) as sales_count,
  SUM(amount) as revenue
FROM sales 
GROUP BY category_id;