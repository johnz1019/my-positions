# Multi-Chain PnL Analysis

This project now supports analyzing liquidity mining and swap activities across multiple blockchains.

## Supported Chains

### 🟡 BSC (Binance Smart Chain)
- **Native Token**: BNB
- **Stable Token**: USDT (18 decimals)
- **Price Symbol**: BNBUSDT
- **Block Explorer**: BSC Scan

### 🔵 Base Chain
- **Native Token**: ETH
- **Stable Token**: USDC (6 decimals)
- **Price Symbol**: ETHUSDT
- **Block Explorer**: Base Scan

## Usage

### Run BSC Analysis
```bash
# BSC chain analysis (original BNB functionality)
npm run debug:bsc

# Or with original combined script (BSC only)
npm run debug:combined
```

### Run Base Chain Analysis
```bash
# Base chain analysis
npm run debug:base
```

### Other Scripts
```bash
# Original scripts (BSC specific)
npm run debug:swap      # Swap transactions only
npm run debug:positions # LP positions only
```

## Configuration

### Environment Variables

#### For BSC Chain:
```bash
export BSCSCAN_API_KEY="your_bscscan_api_key"
export ETHERSCAN_API_KEY="fallback_api_key"  # Used as fallback
```

#### For Base Chain:
```bash
export BASESCAN_API_KEY="your_basescan_api_key"
export ETHERSCAN_API_KEY="fallback_api_key"  # Used as fallback
```

### Chain Configuration

Chain-specific settings are in `src/config/chainConfig.ts`:

```typescript
export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  bsc: {
    name: 'BSC',
    chainId: 56,
    nativeToken: { symbol: 'BNB', address: '0xeeee...', decimals: 18 },
    stableToken: { symbol: 'USDT', address: '0x55d3...', decimals: 18 },
    rpcUrl: 'https://bsc-mainnet.nodereal.io/...',
    priceSymbol: 'BNBUSDT',
    startBlock: 60121380,
    targetTokenId: 655318
  },
  base: {
    name: 'Base',
    chainId: 8453,
    nativeToken: { symbol: 'ETH', address: '0xeeee...', decimals: 18 },
    stableToken: { symbol: 'USDC', address: '0x8335...', decimals: 6 },
    rpcUrl: 'https://mainnet.base.org',
    priceSymbol: 'ETHUSDT',
    startBlock: 0,  // Update this for your needs
    targetTokenId: 0  // Update this for your needs
  }
}
```

## Architecture

### Core Services

1. **MultiChainPnLService** - Universal PnL analysis service
2. **ChainConfig** - Chain-specific configuration system
3. **HistoricalPriceService** - Binance price data with caching
4. **SwapPnLService** - Swap transaction analysis
5. **UniswapPositionsService** - LP position analysis

### Code Structure

```
src/
├── config/
│   └── chainConfig.ts          # Chain configurations
├── services/
│   ├── multiChainPnLService.ts # Universal PnL service
│   ├── swapPnL.ts             # Swap analysis (chain-aware)
│   ├── uniswapPositions.ts    # LP positions
│   └── historicalPriceService.ts # Price data
└── examples/
    ├── testBscPnL.ts          # BSC analysis
    ├── testBasePnL.ts         # Base analysis
    └── testCombinedPnL.ts     # Original BSC script
```

## Features

### ✅ BSC Chain (Fully Implemented)
- [x] Swap transaction analysis
- [x] LP position tracking with fees
- [x] Timeline PnL evolution
- [x] Historical BNB price integration
- [x] Manual initial transaction support
- [x] Position close time corrections
- [x] File-based caching

### 🚧 Base Chain (Basic Implementation)
- [x] Chain configuration
- [x] Basic swap analysis framework
- [x] LP position detection
- [ ] Complete timeline implementation
- [ ] Historical ETH price integration
- [ ] Base-specific optimizations

## Extending to New Chains

To add support for a new chain:

1. **Add chain configuration** in `chainConfig.ts`
2. **Set appropriate tokens** (native, stable)
3. **Configure RPC and block explorer**
4. **Set price symbol** for Binance API
5. **Create chain-specific test script**
6. **Add npm script** in `package.json`

Example for Polygon:
```typescript
polygon: {
  name: 'Polygon',
  chainId: 137,
  nativeToken: { symbol: 'MATIC', address: '0xeeee...', decimals: 18 },
  stableToken: { symbol: 'USDC', address: '0x2791...', decimals: 6 },
  rpcUrl: 'https://polygon-rpc.com',
  priceSymbol: 'MATICUSDT',
  startBlock: 0,
  targetTokenId: 0
}
```

## Data Analysis

### Output Format

Both chains provide:
- **Combined PnL Summary** - Swap + LP positions
- **Timeline Analysis** - Chronological operations
- **Token Analysis** - Net positions and fees
- **Price Analysis** - Historical price-based valuations

### Key Metrics
- Net stable coin position (USDT/USDC)
- Net native token position (BNB/ETH)
- Combined average cost basis
- Total LP fees earned
- Gas cost tracking
- Unrealized/realized P&L

## Notes

### BSC Chain
- Maintains full backward compatibility
- All original features preserved
- Manual initial swap: 90 BNB @ $850
- Position close times corrected

### Base Chain
- New implementation
- Uses USDC (6 decimals) vs USDT (18 decimals)
- Requires Base Scan API key
- ETH-based gas costs

### Price Data
- Uses Binance API for historical prices
- 1-minute resolution with caching
- Automatic interpolation for exact timestamps
- Shared cache across chains

## Troubleshooting

### Common Issues

1. **API Key Errors**
   - Set appropriate scan API keys
   - Check API key validity and rate limits

2. **RPC Connection Issues**
   - Verify RPC URL accessibility
   - Consider alternative RPC providers

3. **No Data Found**
   - Check wallet address for chain activity
   - Verify startBlock and targetTokenId settings
   - Ensure correct chain configuration

4. **Price Data Issues**
   - Binance API rate limiting
   - Check internet connectivity
   - Verify price symbol configuration