// src/provider.ts
import { http, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { polymarket } from "@goat-sdk/plugin-polymarket";
import { viem } from "@goat-sdk/wallet-viem";

export async function getPolymarketClient() {
    // Validate required environment variables
    const apiKey = process.env.POLYMARKET_API_KEY;
    const apiSecret = process.env.POLYMARKET_SECRET;
    const apiPassphrase = process.env.POLYMARKET_PASSPHRASE;
    const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
    const rpcProviderUrl = process.env.RPC_PROVIDER_URL;

    if (!apiKey || !apiSecret || !apiPassphrase) {
        throw new Error("Missing required Polymarket API credentials. Please set POLYMARKET_API_KEY, POLYMARKET_SECRET, and POLYMARKET_PASSPHRASE environment variables.");
    }

    if (!walletPrivateKey || !rpcProviderUrl) {
        throw new Error("Missing required wallet configuration. Please set WALLET_PRIVATE_KEY and RPC_PROVIDER_URL environment variables.");
    }

    try {
        // Create wallet client
        const account = privateKeyToAccount(walletPrivateKey);
        const walletClient = createWalletClient({
            account: account,
            transport: http(rpcProviderUrl),
            chain: polygon,
        });

        // Create Polymarket tools
        const tools = await getOnChainTools({
            wallet: viem(walletClient),
            plugins: [
                polymarket({
                    credentials: {
                        key: apiKey,
                        secret: apiSecret,
                        passphrase: apiPassphrase,
                    },
                }),
            ],
        });

        return { tools, walletClient, account };
    } catch (error) {
        console.error("Failed to initialize Polymarket client:", error);
        throw new Error(`Failed to initialize Polymarket client: ${error.message || 'Unknown error'}`);
    }
}

export const walletProvider = {
    async get(runtime) {
        try {
            const { account } = await getPolymarketClient();
            return `Polymarket Wallet Address: ${account.address}`;
        } catch (error) {
            console.error("Error in Polymarket provider:", error);
            return `Error initializing Polymarket wallet: ${error.message}`;
        }
    }
};

// src/actions.ts
import {
    generateText,
    ModelClass,
    composeContext,
    generateObject
} from "@elizaos/core";

async function getPolymarketActions() {
    const actions = [
        {
            name: "GET_POLYMARKET_EVENTS",
            similes: ["LIST_EVENTS", "SHOW_EVENTS", "VIEW_EVENTS", "GET_MARKETS"],
            description: "Get Polymarket events and markets",
            validate: async () => true,
            handler: async (runtime, message, state, options, callback) => {
                try {
                    const { tools } = await getPolymarketClient();
                    
                    let currentState = state ?? await runtime.composeState(message);
                    currentState = await runtime.updateRecentMessageState(currentState);

                    const eventsContext = composeContext({
                        state: currentState,
                        template: `{{recentMessages}}

Extract any specific event or market criteria from the recent messages. Look for:
- Event names or keywords
- Date ranges
- Market categories
- Active/inactive status
If no specific criteria is mentioned, get general events.`
                    });

                    const { object: params } = await generateObject({
                        runtime,
                        context: eventsContext,
                        modelClass: ModelClass.LARGE,
                        schema: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Search query for events" },
                                limit: { type: "number", description: "Maximum number of events to return", default: 10 },
                                active: { type: "boolean", description: "Filter for active events only", default: true }
                            }
                        }
                    });

                    const eventTool = tools.find(tool => 
                        tool.name?.toLowerCase().includes('event') || 
                        tool.name?.toLowerCase().includes('market')
                    );

                    if (!eventTool) {
                        throw new Error("Events tool not found");
                    }

                    const result = await eventTool.execute?.(params) || await eventTool.call?.(params);

                    const responseText = await generateResponse(
                        runtime,
                        currentState,
                        "GET_POLYMARKET_EVENTS",
                        result,
                        "Retrieved Polymarket events and markets successfully"
                    );

                    callback?.({ text: responseText, content: result });
                    return true;
                } catch (error) {
                    return handleError(error, "GET_POLYMARKET_EVENTS", callback);
                }
            },
            examples: []
        }
    ];

    return actions;
}

async function generateResponse(
    runtime,
    state,
    actionName,
    result,
    successMessage
) {
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

The action "${actionName}" was executed successfully.
${successMessage}

Here is the result:
${JSON.stringify(result, null, 2)}

{{actions}}

Respond to the message knowing that the action was successful and these were the previous messages:
{{recentMessages}}
`;

    const context = composeContext({ state, template: responseTemplate });
    
    return generateText({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
    });
}

function handleError(
    error,
    actionName,
    callback
) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing ${actionName}:`, error);
    
    callback?.({
        text: `Error executing ${actionName}: ${errorMessage}`,
        content: { error: errorMessage },
    });
    
    return false;
}

// src/index.ts
console.log("\n╔═════════════════════════════════════════════════════════════════════════════════════╗");
console.log("║                                                                                       ║");
console.log("║  ██████╗  ██████╗ ██╗   ██╗   ██╗███╗   ███╗ █████╗ ██████╗ ██╗  ██╗███████╗████████╗ ║");
console.log("║  ██╔══██╗██╔═══██╗██║   ╚██╗ ██╔╝████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔════╝╚══██╔══╝ ║");
console.log("║  ██████╔╝██║   ██║██║    ╚████╔╝ ██╔████╔██║███████║██████╔╝█████╔╝ █████╗     ██║    ║");
console.log("║  ██╔═══╝ ██║   ██║██║     ╚██╔╝  ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██╔══╝     ██║    ║");
console.log("║  ██║     ╚██████╔╝███████╗ ██║   ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗███████╗   ██║    ║");
console.log("║  ╚═╝      ╚═════╝ ╚══════╝ ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝    ║");
console.log("║                        ▓▓▓▓▓▓▓  PREDICTION MARKETS  ▓▓▓▓▓▓▓                           ║");
console.log("║                                                                                       ║");
console.log("║    └─────────────────────────────────────────────────────────────────┘                ║");
console.log("║                                                                                       ║");
console.log("║           ▓▓▓ POLYMARKET PLUGIN SYSTEM INITIALIZED ▓▓▓                                ║");
console.log("║                                                                                       ║");
console.log("║    ╭─────────────────────────────────────────────────────────────────╮                ║");
console.log("║    │  📊 Real-time Market Data    │  🎯 Prediction Analytics         │               ║");
console.log("║    │  💹 Trading Interface       │  📈 Portfolio Tracking           │                ║");
console.log("║    │  🔍 Market Discovery        │  ⚡ Lightning Fast Updates       │                ║");
console.log("║    │  🛡️  Secure Transactions    │  🌐 Global Market Access         │                ║");
console.log("║    ╰─────────────────────────────────────────────────────────────────╯                ║");
console.log("║                                                                                       ║");
console.log("║                        Version: 0.0.1 | Build: ALPHA                                  ║");
console.log("║                      Status: ✅ CONNECTED | ⚡ READY                                 ║");
console.log("║                                                                                       ║");
console.log("╚═══════════════════════════════════════════════════════════════════════════════════════╝            ");
console.log("");
console.log("🚀 Polymarket Plugin loaded successfully!");
console.log("📡 Connected to prediction markets API");
console.log("💫 Ready to analyze market sentiment and probabilities");
console.log("");

const initializeActions = async () => {
    try {
        // Validate environment variables
        const apiKey = process.env.POLYMARKET_API_KEY;
        const apiSecret = process.env.POLYMARKET_SECRET;
        const apiPassphrase = process.env.POLYMARKET_PASSPHRASE;
        const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
        const rpcProviderUrl = process.env.RPC_PROVIDER_URL;

        if (!apiKey || !apiSecret || !apiPassphrase) {
            console.warn("⚠️ Missing Polymarket API credentials - Polymarket actions will not be available");
            return [];
        }

        if (!walletPrivateKey || !rpcProviderUrl) {
            console.warn("⚠️ Missing wallet configuration - Polymarket actions will not be available");
            return [];
        }

        const actions = await getPolymarketActions();
        console.log("✔ Polymarket actions initialized successfully.");
        return actions;
    } catch (error) {
        console.error("❌ Failed to initialize Polymarket actions:", error);
        return [];
    }
};

export const polymarketPlugin = {
    name: "[Polymarket] Integration",
    description: "Polymarket prediction market integration plugin",
    providers: [walletProvider],
    evaluators: [],
    services: [],
    actions: await initializeActions(),
};

export default polymarketPlugin;
//# sourceMappingURL=index.js.map