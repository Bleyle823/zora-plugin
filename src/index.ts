import type { Plugin } from "@elizaos/core";
import { zoraProvider, getZoraClients } from "./provider";
import { getZoraActions } from "./actions";

// Initial banner
console.log("\n┌════════════════════════════════════════┐");
console.log("│            ZORA PLUGIN                 │");
console.log("├────────────────────────────────────────┤");
console.log("│  Initializing Zora Plugin...           │");
console.log("│  Version: 0.25.6-alpha.1               │");
console.log("└════════════════════════════════════════┘");

const initializeActions = async () => {
    try {
        // Validate environment variables
        const rpcUrl = process.env.ZORA_RPC_URL;
        const privateKey = process.env.ZORA_PRIVATE_KEY;

        if (!rpcUrl || !privateKey) {
            console.warn("⚠️ Missing Zora credentials - Zora actions will not be available");
            console.warn("Please set ZORA_RPC_URL and ZORA_PRIVATE_KEY environment variables");
            return [];
        }

        const actions = await getZoraActions({
            getClients: getZoraClients,
        });
        console.log("✔ Zora actions initialized successfully.");
        return actions;
    } catch (error) {
        console.error("❌ Failed to initialize Zora actions:", error);
        return []; // Return empty array instead of failing
    }
};

export const zoraPlugin: Plugin = {
    name: "[Zora] Integration",
    description: "Zora coin creation and trading integration plugin",
    providers: [zoraProvider],
    evaluators: [],
    services: [],
    actions: await initializeActions(),
};

export default zoraPlugin;
