-- Denom metadata table for native and IBC denom information
CREATE TABLE IF NOT EXISTS api.denom_metadata (
    denom TEXT PRIMARY KEY,
    base_denom TEXT,
    display_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 6,
    is_ibc BOOLEAN NOT NULL DEFAULT false,
    ibc_hash TEXT,
    ibc_path TEXT,
    chain_id TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ibc_hash)
);

-- Index for IBC denoms
CREATE INDEX IF NOT EXISTS idx_denom_metadata_ibc_hash ON api.denom_metadata(ibc_hash) WHERE is_ibc = true;

-- Index for lookups by base_denom
CREATE INDEX IF NOT EXISTS idx_denom_metadata_base_denom ON api.denom_metadata(base_denom);

-- Seed with common known denoms
INSERT INTO api.denom_metadata (denom, display_name, symbol, decimals, is_ibc) VALUES
    ('ujuno', 'Juno', 'JUNO', 6, false),
    ('uatom', 'Cosmos Hub', 'ATOM', 6, false),
    ('uosmo', 'Osmosis', 'OSMO', 6, false),
    ('uakt', 'Akash', 'AKT', 6, false),
    ('ustars', 'Stargaze', 'STARS', 6, false),
    ('aevmos', 'Evmos', 'EVMOS', 18, false),
    ('inj', 'Injective', 'INJ', 18, false),
    ('axl', 'Axelar', 'AXL', 6, false),
    ('umfx', 'Manifest', 'MFX', 6, false),
    ('upoa', 'POA', 'POA', 6, false)
ON CONFLICT (denom) DO NOTHING;

-- Seed ATOM IBC denom for Juno
INSERT INTO api.denom_metadata (
    denom,
    base_denom,
    display_name,
    symbol,
    decimals,
    is_ibc,
    ibc_hash,
    ibc_path,
    chain_id
) VALUES (
    'ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9',
    'uatom',
    'Cosmos Hub',
    'ATOM',
    6,
    true,
    'C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9',
    'transfer/channel-1',
    'cosmoshub-4'
)
ON CONFLICT (denom) DO UPDATE SET
    base_denom = EXCLUDED.base_denom,
    display_name = EXCLUDED.display_name,
    symbol = EXCLUDED.symbol,
    decimals = EXCLUDED.decimals,
    ibc_path = EXCLUDED.ibc_path,
    chain_id = EXCLUDED.chain_id,
    last_updated = NOW();

COMMENT ON TABLE api.denom_metadata IS 'Metadata for native and IBC denominations';
COMMENT ON COLUMN api.denom_metadata.denom IS 'Full denom string (e.g., ujuno or ibc/HASH)';
COMMENT ON COLUMN api.denom_metadata.base_denom IS 'Base denom for IBC tokens (e.g., uatom for IBC ATOM)';
COMMENT ON COLUMN api.denom_metadata.display_name IS 'Human-readable display name';
COMMENT ON COLUMN api.denom_metadata.symbol IS 'Trading symbol (e.g., ATOM, JUNO)';
COMMENT ON COLUMN api.denom_metadata.decimals IS 'Number of decimal places (6 for micro, 18 for atto)';
COMMENT ON COLUMN api.denom_metadata.is_ibc IS 'Whether this is an IBC denom';
COMMENT ON COLUMN api.denom_metadata.ibc_hash IS 'IBC denom hash (extracted from ibc/HASH format)';
COMMENT ON COLUMN api.denom_metadata.ibc_path IS 'IBC transfer path (e.g., transfer/channel-1)';
COMMENT ON COLUMN api.denom_metadata.chain_id IS 'Source chain ID for IBC denoms';
