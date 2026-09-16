-- Migration 002 down: Remove block_results_raw table

BEGIN;

DROP TABLE IF EXISTS api.block_results_raw;

COMMIT;
