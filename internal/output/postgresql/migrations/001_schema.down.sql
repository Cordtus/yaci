-- Drop all schema objects
BEGIN;

DROP VIEW IF EXISTS api.evm_address_activity;
DROP VIEW IF EXISTS api.evm_tx_map;

DROP FUNCTION IF EXISTS api.get_messages_for_address(TEXT);
DROP FUNCTION IF EXISTS api.extract_event_msg_index(jsonb);
DROP FUNCTION IF EXISTS api.update_event_main();
DROP FUNCTION IF EXISTS api.update_events_raw();
DROP FUNCTION IF EXISTS update_message_main();
DROP FUNCTION IF EXISTS update_transaction_main();
DROP FUNCTION IF EXISTS extract_proposal_ids(JSONB);
DROP FUNCTION IF EXISTS extract_proposal_failure_logs(JSONB);
DROP FUNCTION IF EXISTS extract_metadata(JSONB);
DROP FUNCTION IF EXISTS extract_addresses(JSONB);

DROP TABLE IF EXISTS api.events_main;
DROP TABLE IF EXISTS api.events_raw;
DROP TABLE IF EXISTS api.messages_main;
DROP TABLE IF EXISTS api.messages_raw;
DROP TABLE IF EXISTS api.transactions_main;
DROP TABLE IF EXISTS api.transactions_raw;
DROP TABLE IF EXISTS api.blocks_raw;

DROP SCHEMA IF EXISTS api CASCADE;

COMMIT;
