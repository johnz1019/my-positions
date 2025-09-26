# Swap PnL Service

这个服务用于分析指定地址的 `smartSwapByOrderId` 交易并计算盈亏（PnL）。

## 功能特性

1. **📊 交易获取**: 通过 Etherscan API 获取指定地址的所有交易
2. **🔍 智能筛选**: 筛选出调用 `smartSwapByOrderId` 函数的交易
3. **🧾 事件解析**: 解析交易收据中的 `OrderRecord` 事件
4. **💰 PnL 计算**: 计算代币交易的盈亏和汇总统计

## 环境要求

```bash
npm install axios ethers @types/node
```

## 配置

需要 Etherscan API Key：

```bash
export ETHERSCAN_API_KEY="your_etherscan_api_key"
```

获取 API Key: https://etherscan.io/apis

## 使用方法

### 基础用法

```typescript
import { SwapPnLService } from './src/services/swapPnL';

const service = new SwapPnLService('YOUR_ETHERSCAN_API_KEY');

// 分析指定地址的交换交易
const pnlData = await service.getSwapPnLData('0x1234...');

console.log('Total transactions:', pnlData.transactions.length);
console.log('Total gas cost:', pnlData.totalGasCost);
```

### 高级用法

```typescript
// 指定区块范围
const pnlData = await service.getSwapPnLData(
  '0x1234...',
  19000000,  // 开始区块
  'latest'   // 结束区块
);

// 获取代币信息
const tokenInfo = await service.getTokenInfo('0xTokenAddress');
console.log(`${tokenInfo.symbol} (${tokenInfo.decimals} decimals)`);

// 格式化金额
const formattedAmount = service.formatTokenAmount('1000000000000000000', 18);
console.log(formattedAmount); // "1.0"
```

## 数据结构

### OrderRecord

```typescript
interface OrderRecord {
  fromToken: string;        // 输入代币地址
  toToken: string;          // 输出代币地址
  sender: string;           // 发送者地址
  fromAmount: string;       // 输入金额
  returnAmount: string;     // 返回金额
  transactionHash: string;  // 交易哈希
  blockNumber: string;      // 区块号
  timestamp: string;        // 时间戳
  gasUsed: string;         // Gas 使用量
  gasPrice: string;        // Gas 价格
}
```

### SwapPnLData

```typescript
interface SwapPnLData {
  transactions: OrderRecord[];           // 所有交易记录
  tokenSummary: Record<string, {         // 代币汇总
    totalIn: bigint;                     // 总输入
    totalOut: bigint;                    // 总输出
    netAmount: bigint;                   // 净额
    transactionCount: number;            // 交易次数
  }>;
  totalGasCost: bigint;                  // 总 Gas 费用
  profitableSwaps: number;               // 盈利交易数
  unprofitableSwaps: number;             // 亏损交易数
}
```

## 测试

运行测试示例：

```bash
ETHERSCAN_API_KEY=your_key npx tsx src/examples/testSwapPnL.ts
```

## 主要功能

### 1. 交易筛选

自动筛选包含 `smartSwapByOrderId` 函数调用的成功交易：

```typescript
const smartSwapTxs = service.filterSmartSwapTransactions(allTransactions);
```

### 2. 事件解析

解析 `OrderRecord` 事件，提取交换详情：

```solidity
event OrderRecord(
    address fromToken,
    address toToken,
    address sender,
    uint256 fromAmount,
    uint256 returnAmount
)
```

### 3. PnL 统计

- **代币级别统计**: 每个代币的输入/输出/净额
- **交易级别分析**: 盈利/亏损交易数量统计
- **Gas 费用统计**: 总 Gas 消耗成本

### 4. 代币信息

自动获取 ERC20 代币的基本信息：

```typescript
const info = await service.getTokenInfo(tokenAddress);
// { symbol: "USDT", decimals: 6 }
```

## 注意事项

1. **API 限制**: Etherscan API 有请求频率限制，服务中包含适当的延迟
2. **区块范围**: 建议使用合理的区块范围避免查询过多数据
3. **价格数据**: 当前版本不包含历史价格数据，需要集成价格 API 进行准确的 USD 价值计算
4. **Gas 费用**: 包含在总成本计算中，影响最终盈亏

## 实际应用示例

```typescript
async function analyzeSwapPerformance(address: string) {
  const service = new SwapPnLService(API_KEY);

  const data = await service.getSwapPnLData(address, 19000000);

  console.log('📊 交易分析报告');
  console.log('================');
  console.log(`总交易数: ${data.transactions.length}`);
  console.log(`盈利交易: ${data.profitableSwaps}`);
  console.log(`亏损交易: ${data.unprofitableSwaps}`);
  console.log(`Gas 总成本: ${service.formatEther(data.totalGasCost.toString())} ETH`);

  // 分析最活跃的交易对
  const tokenPairs = new Map();
  for (const tx of data.transactions) {
    const pair = `${tx.fromToken.slice(0,6)}...→${tx.toToken.slice(0,6)}...`;
    tokenPairs.set(pair, (tokenPairs.get(pair) || 0) + 1);
  }

  console.log('\n🔄 热门交易对:');
  [...tokenPairs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([pair, count]) => {
      console.log(`  ${pair}: ${count} 次`);
    });
}
```

## 扩展功能

可以扩展的功能包括：

1. **价格集成**: 集成 CoinGecko 或其他价格 API
2. **多链支持**: 支持 BSC, Polygon 等其他链
3. **更多事件**: 解析其他相关事件类型
4. **持久化**: 将数据保存到数据库
5. **可视化**: 生成图表和报告

这个服务为交换交易分析提供了强大的基础框架！