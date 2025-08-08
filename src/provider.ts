import type { Provider, IAgentRuntime } from '@elizaos/core';
import { createWalletClient, createPublicClient, http, type Hex, type PublicClient, type WalletClient, type Account } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export interface ZoraClients {
    publicClient: PublicClient;
    walletClient: WalletClient;
    account: Account;
}

export async function getZoraClients(): Promise<ZoraClients> {
    // Validate required environment variables
    const rpcUrl = process.env.ZORA_RPC_URL;
    const privateKey = process.env.ZORA_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
        throw new Error(
            'Missing required Zora credentials. Please set ZORA_RPC_URL and ZORA_PRIVATE_KEY environment variables.'
        );
    }

    // Infer chain from env or RPC URL
    // Priority: explicit ZORA_CHAIN -> RPC URL hints -> default Base mainnet
    const zoraChainEnv = (process.env.ZORA_CHAIN || '').toLowerCase();
    const rpcUrlLower = rpcUrl.toLowerCase();
    const isSepoliaEnv = zoraChainEnv === 'base-sepolia' || zoraChainEnv === 'basesepolia' || zoraChainEnv === 'sepolia';
    const isSepoliaRpc = rpcUrlLower.includes('sepolia') || rpcUrlLower.includes('84532');
    const chain = isSepoliaEnv || isSepoliaRpc ? baseSepolia : base;

    if (process.env.DEBUG_ZORA) {
        // eslint-disable-next-line no-console
        console.log(`[Zora] Using chain: ${chain.name} (id: ${chain.id}) with RPC: ${rpcUrl}`);
    }

    // Set up account
    const account = privateKeyToAccount(privateKey as Hex);

    // Set up viem clients
    const publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
    }) as PublicClient;

    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
    }) as WalletClient;

    return {
        publicClient,
        walletClient,
        account,
    };
}

export const zoraProvider: Provider = {
    async get(_runtime: IAgentRuntime): Promise<string | null> {
        try {
            const clients = await getZoraClients();
            return `Zora Wallet Address: ${clients.account.address}`;
        } catch (error) {
            console.error('Error in Zora provider:', error);
            return `Error initializing Zora wallet: ${(error as Error).message}`;
        }
    },
};
