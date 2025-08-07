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
} from "@elizaos/core";
import { createCoin, DeployCurrency, ValidMetadataURI, tradeCoin, TradeParameters } from "@zoralabs/coins-sdk";
import { parseEther, type Hex, type Address } from "viem";
import { getZoraClients, type ZoraClients } from "./provider";

type GetZoraActionsParams = {
    getClients: () => Promise<ZoraClients>;
};

/**
 * Get all Zora actions
 */
export async function getZoraActions({
    getClients,
}: GetZoraActionsParams): Promise<Action[]> {
    return [
        createCoinAction(getClients),
        tradeCoinAction(getClients),
    ];
}

function createCoinAction(getClients: () => Promise<ZoraClients>): Action {
    return {
        name: "CREATE_COIN",
        description: "Create a new coin on Zora using the Zora Coins SDK. This action allows you to deploy a new creator coin with specified parameters including name, symbol, metadata URI, and payout recipient.",
        similes: ["deploy coin", "create token", "mint coin", "launch coin"],
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
                    "CREATE_COIN",
                    currentState,
                    "Extract coin creation parameters including name, symbol, metadata URI, and payout recipient address."
                );
                
                const parameters = await generateParameters(
                    runtime,
                    parameterContext,
                    {
                        name: "string",
                        symbol: "string", 
                        uri: "string",
                        payoutRecipient: "string",
                        platformReferrer: "string (optional)",
                        currency: "string (ZORA or ETH, optional)"
                    }
                );

                const coinParams = {
                    name: parameters.name,
                    symbol: parameters.symbol,
                    uri: parameters.uri as ValidMetadataURI,
                    payoutRecipient: parameters.payoutRecipient as Address,
                    platformReferrer: parameters.platformReferrer as Address || undefined,
                    currency: parameters.currency === "ZORA" ? DeployCurrency.ZORA : DeployCurrency.ETH,
                };

                const result = await createCoin(coinParams, clients.walletClient, clients.publicClient, {
                    gasMultiplier: 120,
                });

                const responseContext = composeResponseContext(
                    "CREATE_COIN",
                    result,
                    currentState
                );
                const response = await generateResponse(runtime, responseContext);

                callback?.({ 
                    text: response, 
                    content: {
                        transactionHash: result.hash,
                        coinAddress: result.address,
                        deploymentDetails: result.deployment
                    }
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
            "Create a coin named 'My Awesome Coin' with symbol 'MAC'",
            "Deploy a new creator coin with metadata URI and payout address",
            "Launch a new token on Zora platform"
        ],
    };
}

function tradeCoinAction(getClients: () => Promise<ZoraClients>): Action {
    return {
        name: "TRADE_COIN",
        description: "Trade coins on Zora using the Zora Coins SDK. This action allows you to buy or sell coins with specified amounts, slippage tolerance, and trade parameters.",
        similes: ["buy coin", "sell coin", "swap coin", "trade token"],
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
                    "TRADE_COIN",
                    currentState,
                    "Extract trade parameters including sell type (eth), buy type (erc20), coin address, amount in ETH, and slippage tolerance."
                );
                
                const parameters = await generateParameters(
                    runtime,
                    parameterContext,
                    {
                        sellType: "string (eth)",
                        buyType: "string (erc20)",
                        coinAddress: "string (coin contract address)",
                        amountIn: "string (amount in ETH as string)",
                        slippage: "number (slippage tolerance as decimal)"
                    }
                );

                const tradeParameters: TradeParameters = {
                    sell: { type: parameters.sellType },
                    buy: {
                        type: parameters.buyType,
                        address: parameters.coinAddress as Address,
                    },
                    amountIn: parseEther(parameters.amountIn),
                    slippage: parameters.slippage,
                    sender: clients.account.address,
                };

                const result = await tradeCoin({
                    tradeParameters,
                    walletClient: clients.walletClient,
                    account: clients.account,
                    publicClient: clients.publicClient,
                });

                const responseContext = composeResponseContext(
                    "TRADE_COIN",
                    result,
                    currentState
                );
                const response = await generateResponse(runtime, responseContext);

                callback?.({ 
                    text: response, 
                    content: {
                        transactionHash: result.hash,
                        tradeDetails: result
                    }
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
            "Buy 0.001 ETH worth of coin at address 0x4e93a01c90f812284f71291a8d1415a904957156",
            "Trade ETH for a creator coin with 5% slippage tolerance",
            "Swap ETH for a specific coin token"
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

async function generateParameters(
    runtime: IAgentRuntime,
    context: string,
    schema: Record<string, string>
): Promise<unknown> {
    const { object } = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
        schema,
    });

    return object;
}

function composeResponseContext(
    actionName: string,
    result: unknown,
    state: State
): string {
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
${JSON.stringify(result)}

{{actions}}

Respond to the message knowing that the action was successful and these were the previous messages:
{{recentMessages}}
`;
    return composeContext({ state, template: responseTemplate });
}

async function generateResponse(
    runtime: IAgentRuntime,
    context: string
): Promise<string> {
    return generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });
}
