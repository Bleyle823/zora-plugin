import type { Provider, IAgentRuntime } from "@elizaos/core";
import { createWalletClient, createPublicClient, http, type Hex, type Address } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

export interface ZoraClients {
    publicClient: ReturnType<typeof createPublicClient>;
    walletClient: ReturnType<typeof createWalletClient>;
    account: ReturnType<typeof privateKeyToAccount>;
}

export async function getZoraClients(): Promise<ZoraClients> {
    // Validate required environment variables
    const rpcUrl = process.env.ZORA_RPC_URL;
    const privateKey = process.env.ZORA_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
        throw new Error("Missing required Zora credentials. Please set ZORA_RPC_URL and ZORA_PRIVATE_KEY environment variables.");
    }

    // Set up account
    const account = privateKeyToAccount(privateKey as Hex);

    // Set up viem clients
    const publicClient = createPublicClient({
        chain: base,
        transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
        account: account.address as Hex,
        chain: base,
        transport: http(rpcUrl),
    });

    return {
        publicClient,
        walletClient,
        account
    };
}

export const zoraProvider: Provider = {
    async get(_runtime: IAgentRuntime): Promise<string | null> {
        try {
            const clients = await getZoraClients();
            return `Zora Wallet Address: ${clients.account.address}`;
        } catch (error) {
            console.error("Error in Zora provider:", error);
            return `Error initializing Zora wallet: ${error.message}`;
        }
    },
};
