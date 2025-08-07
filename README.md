# @elizaos/plugin-zora

A Zora integration plugin for ElizaOS that enables coin creation and trading functionality using the Zora Coins SDK.

## Features

- **CREATE_COIN**: Deploy new creator coins on Zora with customizable parameters
- **TRADE_COIN**: Buy and sell coins on Zora with slippage protection
- **Base Chain Integration**: Built-in support for Base chain operations
- **Viem Integration**: Modern Ethereum client integration

## Installation

```bash
npm install @elizaos/plugin-zora
```

## Configuration

Set the following environment variables:

```bash
ZORA_RPC_URL=your_base_rpc_url_here
ZORA_PRIVATE_KEY=your_private_key_here
```

## Usage

### Creating a Coin

The plugin provides a `CREATE_COIN` action that allows you to deploy new creator coins:

```typescript
// Example coin creation parameters
const coinParams = {
  name: "My Awesome Coin",
  symbol: "MAC",
  uri: "ipfs://bafybeigoxzqzbnxsn35vq7lls3ljxdcwjafxvbvkivprsodzrptpiguysy",
  payoutRecipient: "0xYourAddress",
  platformReferrer: "0xOptionalPlatformReferrerAddress", // Optional
  currency: "ZORA" // or "ETH"
};
```

### Trading Coins

The plugin provides a `TRADE_COIN` action for buying and selling coins:

```typescript
// Example trade parameters
const tradeParams = {
  sellType: "eth",
  buyType: "erc20",
  coinAddress: "0x4e93a01c90f812284f71291a8d1415a904957156",
  amountIn: "0.001", // Amount in ETH as string
  slippage: 0.05 // 5% slippage tolerance
};
```

## Actions

### CREATE_COIN

Creates a new coin on Zora using the Zora Coins SDK.

**Parameters:**
- `name` (string): The name of the coin
- `symbol` (string): The symbol of the coin
- `uri` (string): Metadata URI (IPFS or HTTP)
- `payoutRecipient` (string): Address to receive payouts
- `platformReferrer` (string, optional): Platform referrer address
- `currency` (string, optional): "ZORA" or "ETH" (defaults to "ETH")

**Examples:**
- "Create a coin named 'My Awesome Coin' with symbol 'MAC'"
- "Deploy a new creator coin with metadata URI and payout address"
- "Launch a new token on Zora platform"

### TRADE_COIN

Trades coins on Zora using the Zora Coins SDK.

**Parameters:**
- `sellType` (string): Type of asset to sell (typically "eth")
- `buyType` (string): Type of asset to buy (typically "erc20")
- `coinAddress` (string): The coin contract address
- `amountIn` (string): Amount in ETH as string
- `slippage` (number): Slippage tolerance as decimal

**Examples:**
- "Buy 0.001 ETH worth of coin at address 0x4e93a01c90f812284f71291a8d1415a904957156"
- "Trade ETH for a creator coin with 5% slippage tolerance"
- "Swap ETH for a specific coin token"

## Dependencies

- `@zoralabs/coins-sdk`: Zora Coins SDK for coin operations
- `viem`: Modern Ethereum client library
- `@elizaos/core`: ElizaOS core framework

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Development mode with watch
npm run dev
```

## License

This plugin is part of the ElizaOS ecosystem and follows the same licensing terms.
