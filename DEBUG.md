# Debug Environment Setup

## Overview
Debug configuration has been set up for both Swap PnL and Positions services to allow step-through debugging.

## VS Code Debug Configuration

The `.vscode/launch.json` file contains two debug configurations:

### 1. Debug testSwapPnL
- **Target**: `src/examples/testSwapPnL.ts`
- **Runtime**: Node.js with tsx loader for TypeScript support
- **Environment**: Etherscan API key pre-configured
- **Console**: Integrated terminal for better output visibility

### 2. Debug testPositionsService
- **Target**: `src/examples/testPositionsService.ts`
- **Runtime**: Node.js with tsx loader for TypeScript support
- **Console**: Integrated terminal for better output visibility

## How to Debug

### Method 1: VS Code Debug Panel
1. Open VS Code in the project root
2. Go to Run and Debug panel (Ctrl+Shift+D)
3. Select "Debug testSwapPnL" from the dropdown
4. Set breakpoints in the code by clicking on line numbers
5. Press F5 or click the green play button to start debugging

### Method 2: npm Scripts
Run the following commands in terminal:

```bash
# Debug swap PnL service
npm run debug:swap

# Debug positions service
npm run debug:positions
```

## Setting Breakpoints

You can set breakpoints in the following key locations for debugging:

### testSwapPnL.ts
- Line 19: Before calling `getSwapPnLData()`
- Line 32: Inside transaction processing loop
- Line 64: Before token info fetching

### SwapPnLService.ts
- Line 169: `filterSmartSwapTransactions()` method
- Line 179: `parseOrderRecordEvents()` method
- Line 206: Token summary calculation loop

### testPositionsService.ts
- Line 15: Before calling `getPositions()`
- Line 44: Position filtering logic
- Line 95: Summary calculation

## Environment Variables

The debug configuration automatically sets:
- `ETHERSCAN_API_KEY`: Pre-configured for testing

## Tips for Debugging

1. **Watch Variables**: Add variables to the Watch panel to monitor their values
2. **Call Stack**: Use the call stack to navigate between function calls
3. **Step Controls**:
   - F10: Step Over
   - F11: Step Into
   - Shift+F11: Step Out
   - F5: Continue

4. **Console**: Use the Debug Console to evaluate expressions during debugging

## Example Debugging Session

1. Set a breakpoint at line 19 in `testSwapPnL.ts`
2. Start debugging with "Debug testSwapPnL"
3. When execution pauses, inspect the `testAddress` and `startBlock` variables
4. Step into `getSwapPnLData()` method to debug the service logic
5. Continue stepping through to see how transactions are filtered and events parsed

This setup provides full debugging capabilities for understanding the swap PnL analysis process step by step.