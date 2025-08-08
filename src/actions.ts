import {
    type Action,
    generateText,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
    composeContext,
    generateObject,
    type ActionExample,
    type Content,
} from '@elizaos/core';
import {
    createCoin,
    DeployCurrency,
    ValidMetadataURI,
    tradeCoin,
    TradeParameters,
} from '@zoralabs/coins-sdk';
import { parseEther, type Hex, type Address } from 'viem';
import { z } from 'zod';
import { getZoraClients, type ZoraClients } from './provider';

// Safely stringify objects containing BigInt by converting them to strings
function safeStringify(value: unknown): string {
    return JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val));
}

type GetZoraActionsParams = {
    getClients: () => Promise<ZoraClients>;
};

/**
 * Get all Zora actions
 */
export async function getZoraActions({ getClients }: GetZoraActionsParams): Promise<Action[]> {
    return [createCoinAction(getClients), tradeCoinAction(getClients)];
}

async function ensureMetadataUri(
    runtime: IAgentRuntime,
    params: { name: string; symbol: string; uri?: string; image?: string; description?: string }
): Promise<string> {
    // If a plausible URI is provided, use it as-is
    const provided = params.uri?.trim();
    if (provided && (provided.startsWith('ipfs://') || provided.startsWith('http://') || provided.startsWith('https://'))) {
        return provided;
    }

    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
        throw new Error('Missing PINATA_JWT. Cannot auto-generate metadata URI. Provide a valid uri or set PINATA_JWT to enable auto-pinning.');
    }

    const defaultImageCid = process.env.PINATA_DEFAULT_IMAGE_CID;
    const image = params.image?.trim() || (defaultImageCid ? `ipfs://${defaultImageCid}` : undefined);
    const description = params.description?.trim() || `Creator coin for ${params.name}`;

    const metadata = {
        name: params.name,
        description,
        ...(image ? { image } : {}),
    } as Record<string, unknown>;

    const body = {
        pinataContent: metadata,
        pinataMetadata: { name: `zora-coin-${params.symbol}-${Date.now()}` },
    };

    const response = await runtime.fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${pinataJwt}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Pinata pinJSONToIPFS failed: ${response.status} ${response.statusText} ${text}`);
    }

    const json = (await response.json()) as { IpfsHash?: string };
    if (!json.IpfsHash) {
        throw new Error('Pinata response missing IpfsHash');
    }

    return `ipfs://${json.IpfsHash}`;
}

function createCoinAction(getClients: () => Promise<ZoraClients>): Action {
    return {
        name: 'CREATE_COIN',
        description:
            'Create a new coin on Zora using the Zora Coins SDK. This action allows you to deploy a new creator coin with specified parameters including name, symbol, metadata URI, and payout recipient.',
        similes: ['deploy coin', 'create token', 'mint coin', 'launch coin'],
        validate: async () => true,
        handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            state: State | undefined,
            _options?: Record<string, unknown>,
            callback?: HandlerCallback
        ): Promise<boolean> => {
            try {
                const clients = await getClients();
                let currentState = state ?? (await runtime.composeState(message));
                currentState = await runtime.updateRecentMessageState(currentState);

                const parameterContext = composeParameterContext(
                    'CREATE_COIN',
                    currentState,
                    'Extract coin creation parameters including name, symbol, metadata URI (optional), payout recipient address. Optionally include image and description for metadata.'
                );

                const createCoinSchema = z.object({
                    name: z.string(),
                    symbol: z.string(),
                    uri: z.string().optional(),
                    image: z.string().optional(),
                    description: z.string().optional(),
                    payoutRecipient: z.string(),
                    platformReferrer: z.string().optional(),
                    currency: z.enum(['ZORA', 'ETH']).optional(),
                });

                const parameters = await generateParameters(runtime, parameterContext, createCoinSchema);

                const resolvedUri = await ensureMetadataUri(runtime, {
                    name: parameters.name,
                    symbol: parameters.symbol,
                    uri: parameters.uri,
                    image: parameters.image,
                    description: parameters.description,
                });

                const coinParams = {
                    name: parameters.name,
                    symbol: parameters.symbol,
                    uri: resolvedUri as ValidMetadataURI,
                    payoutRecipient: parameters.payoutRecipient as Address,
                    platformReferrer: (parameters.platformReferrer as Address) || undefined,
                    currency:
                        parameters.currency === 'ZORA' ? DeployCurrency.ZORA : DeployCurrency.ETH,
                } as const;

                // Cast to any to accommodate varying SDK signatures across versions
                const result = await (createCoin as unknown as (
                    ...args: any[]
                ) => Promise<any>)(
                    coinParams,
                    clients.walletClient as any,
                    clients.publicClient as any,
                    {
                        gasMultiplier: 120,
                    }
                );

                const responseContext = composeResponseContext('CREATE_COIN', result, currentState);
                const response = await generateResponse(runtime, responseContext);

                callback?.({
                    text: response,
                    content: {
                        transactionHash: (result as any).hash,
                        coinAddress: (result as any).address,
                        deploymentDetails: (result as any).deployment,
                    },
                });
                return true;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                callback?.({
                    text: `Error creating coin: ${errorMessage}`,
                    content: { error: errorMessage },
                });
                return false;
            }
        },
        examples: [
            [
                {
                    user: "{{user1}}",
                    content: { text: "Create a coin named 'My Awesome Coin' with symbol 'MAC'" } as Content,
                } as ActionExample,
                {
                    user: "{{user2}}",
                    content: { text: "I'll create that coin for you", action: "CREATE_COIN" } as Content,
                } as ActionExample,
            ],
            [
                {
                    user: "{{user1}}",
                    content: { text: "Deploy a new creator coin with metadata URI and payout address" } as Content,
                } as ActionExample,
                {
                    user: "{{user2}}",
                    content: { text: "Creating your creator coin now", action: "CREATE_COIN" } as Content,
                } as ActionExample,
            ],
            [
                {
                    user: "{{user1}}",
                    content: { text: "Launch a new token on Zora platform" } as Content,
                } as ActionExample,
                {
                    user: "{{user2}}",
                    content: { text: "Launching your token on Zora", action: "CREATE_COIN" } as Content,
                } as ActionExample,
            ],
        ],
    };
}

function tradeCoinAction(getClients: () => Promise<ZoraClients>): Action {
    return {
        name: 'TRADE_COIN',
        description:
            'Trade coins on Zora using the Zora Coins SDK. This action allows you to buy or sell coins with specified amounts, slippage tolerance, and trade parameters.',
        similes: ['buy coin', 'sell coin', 'swap coin', 'trade token'],
        validate: async () => true,
        handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            state: State | undefined,
            _options?: Record<string, unknown>,
            callback?: HandlerCallback
        ): Promise<boolean> => {
            try {
                const clients = await getClients();
                let currentState = state ?? (await runtime.composeState(message));
                currentState = await runtime.updateRecentMessageState(currentState);

                const parameterContext = composeParameterContext(
                    'TRADE_COIN',
                    currentState,
                    'Extract trade parameters including sell type (eth), buy type (erc20), coin address, amount in ETH, and slippage tolerance.'
                );

                const tradeCoinSchema = z.object({
                    sellType: z.enum(['eth']).default('eth'),
                    buyType: z.enum(['erc20']).default('erc20'),
                    coinAddress: z.string(),
                    amountIn: z.string(),
                    slippage: z.number().default(0.05),
                });

                const parameters = await generateParameters(runtime, parameterContext, tradeCoinSchema);

                const tradeParameters: TradeParameters = {
                    sell: { type: 'eth' },
                    buy: {
                        type: 'erc20',
                        address: parameters.coinAddress as Address,
                    },
                    amountIn: parseEther(parameters.amountIn),
                    slippage: parameters.slippage,
                    sender: (clients.account.address as unknown) as Address,
                } as unknown as TradeParameters;

                const result = await (tradeCoin as unknown as (
                    args: any
                ) => Promise<any>)({
                    tradeParameters,
                    walletClient: clients.walletClient as any,
                    account: clients.account as any,
                    publicClient: clients.publicClient as any,
                });

                const responseContext = composeResponseContext('TRADE_COIN', result, currentState);
                const response = await generateResponse(runtime, responseContext);

                callback?.({
                    text: response,
                    content: {
                        transactionHash: (result as any).hash,
                        tradeDetails: result,
                    },
                });
                return true;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                callback?.({
                    text: `Error trading coin: ${errorMessage}`,
                    content: { error: errorMessage },
                });
                return false;
            }
        },
        examples: [
            [
                {
                    user: "{{user1}}",
                    content: { text: "Buy 0.001 ETH worth of coin at address 0x4e93a01c90f812284f71291a8d1415a904957156" } as Content,
                } as ActionExample,
                {
                    user: "{{user2}}",
                    content: { text: "I'll execute that trade for you", action: "TRADE_COIN" } as Content,
                } as ActionExample,
            ],
            [
                {
                    user: "{{user1}}",
                    content: { text: "Trade ETH for a creator coin with 5% slippage tolerance" } as Content,
                } as ActionExample,
                {
                    user: "{{user2}}",
                    content: { text: "Executing the trade with 5% slippage", action: "TRADE_COIN" } as Content,
                } as ActionExample,
            ],
            [
                {
                    user: "{{user1}}",
                    content: { text: "Swap ETH for a specific coin token" } as Content,
                } as ActionExample,
                {
                    user: "{{user2}}",
                    content: { text: "Swapping ETH for your coin", action: "TRADE_COIN" } as Content,
                } as ActionExample,
            ],
        ],
    };
}

function composeParameterContext(actionName: string, state: State, description: string): string {
    const contextTemplate = `{{recentMessages}}

Given the recent messages, extract the following information for the action "${actionName}":
${description}

Please provide the parameters in the correct format.
`;
    return composeContext({ state, template: contextTemplate });
}

async function generateParameters<T>(
    runtime: IAgentRuntime,
    context: string,
    schema: z.ZodSchema<T>
): Promise<T> {
    const { object } = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
        schema,
    });

    return object as T;
}

function composeResponseContext(actionName: string, result: unknown, state: State): string {
    const responseTemplate = `
# Action Examples
{{actionExamples}}

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

The Zora action "${actionName}" was executed successfully.
Here is the result:
${safeStringify(result)}

{{actions}}

Respond to the message knowing that the action was successful and these were the previous messages:
{{recentMessages}}
`;
    return composeContext({ state, template: responseTemplate });
}

async function generateResponse(runtime: IAgentRuntime, context: string): Promise<string> {
    return generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });
}
