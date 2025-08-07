// Test setup for Polymarket plugin
import { vi } from 'vitest';

// Mock environment variables for testing
process.env.POLYMARKET_API_KEY = 'test-api-key';
process.env.POLYMARKET_SECRET = 'test-secret';
process.env.POLYMARKET_PASSPHRASE = 'test-passphrase';
process.env.WALLET_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
process.env.RPC_PROVIDER_URL = 'https://polygon-rpc.com';

// Global test configuration
global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}; 