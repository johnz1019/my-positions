# Uniswap V3 Events Service

这个服务用于从 Uniswap V3 subgraph 获取指定地址的 mint、burn、collect 等事件历史记录。

## 功能特性

- 获取 Mint 事件（添加流动性）
- 获取 Burn 事件（移除流动性）
- 获取 Collect 事件（收取手续费）
- 支持按地址、池子、时间范围等条件过滤
- 完整的 TypeScript 类型定义

## 安装依赖

```bash
npm install graphql-request
```

## 配置 API Key

1. 访问 [The Graph Studio](https://thegraph.com/studio/)
2. 创建账户并获取 API Key
3. 设置环境变量：
   ```bash
   export THE_GRAPH_API_KEY=your_api_key_here
   ```

## 使用方法

### 基础用法

```typescript
import { UniswapEventsService } from './src/services/uniswapEvents';

const eventsService = new UniswapEventsService('YOUR_API_KEY');

// 获取指定地址的所有事件
const events = await eventsService.getPositionEvents('0x1234...');
```

### 获取特定类型事件

```typescript
// 获取 mint 事件
const mintEvents = await eventsService.getMintEvents({
  owner: '0x1234...',
  first: 100,
  orderBy: 'timestamp',
  orderDirection: 'desc'
});

// 获取 burn 事件
const burnEvents = await eventsService.getBurnEvents({
  owner: '0x1234...',
  pool: '0xabcd...'
});

// 获取 collect 事件
const collectEvents = await eventsService.getCollectEvents({
  owner: '0x1234...',
  timestampGte: 1640995200 // 从某个时间开始
});
```

### 过滤条件

支持的过滤条件：

```typescript
interface EventsFilter {
  owner?: string;           // 持仓所有者地址
  sender?: string;          // 发送者地址（仅 mint 事件）
  pool?: string;            // 池子地址
  first?: number;           // 返回数量限制
  skip?: number;            // 跳过数量
  orderBy?: string;         // 排序字段
  orderDirection?: 'asc' | 'desc'; // 排序方向
  timestampGte?: number;    // 开始时间戳
  timestampLte?: number;    // 结束时间戳
}
```

## 数据结构

### MintEvent（添加流动性事件）

```typescript
interface MintEvent {
  id: string;
  transaction: {
    id: string;
    timestamp: string;
    blockNumber: string;
  };
  pool: {
    id: string;
    token0: { id: string; symbol: string; name: string; decimals: string; };
    token1: { id: string; symbol: string; name: string; decimals: string; };
  };
  owner: string;      // 持仓所有者
  sender: string;     // 交易发送者
  amount: string;     // 流动性数量
  amount0: string;    // token0 数量
  amount1: string;    // token1 数量
  amountUSD: string;  // USD 价值
  tickLower: string;  // 价格区间下限
  tickUpper: string;  // 价格区间上限
}
```

### BurnEvent（移除流动性事件）

```typescript
interface BurnEvent {
  id: string;
  transaction: { /* 同上 */ };
  pool: { /* 同上 */ };
  owner: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  tickLower: string;
  tickUpper: string;
}
```

### CollectEvent（收取手续费事件）

```typescript
interface CollectEvent {
  id: string;
  transaction: { /* 同上 */ };
  pool: { /* 同上 */ };
  owner: string;
  amount0: string;    // 收取的 token0 手续费
  amount1: string;    // 收取的 token1 手续费
  amountUSD: string;  // USD 价值
  tickLower: string;
  tickUpper: string;
}
```

## 测试

运行测试示例：

```bash
THE_GRAPH_API_KEY=your_key npx tsx src/examples/testEventsService.ts
```

## 错误处理

服务包含完整的错误处理，会抛出详细的错误信息：

```typescript
try {
  const events = await eventsService.getMintEvents({ owner: address });
} catch (error) {
  console.error('获取事件失败:', error.message);
}
```

## 注意事项

1. **API Key 必需**：The Graph 现在要求使用 API Key 才能访问 subgraph
2. **查询限制**：单次查询最多返回 1000 条记录，使用分页获取更多数据
3. **地址格式**：所有地址会自动转换为小写格式
4. **时间戳**：使用 Unix 时间戳格式

## 实际应用示例

```typescript
// 分析用户的流动性管理活动
async function analyzeUserActivity(userAddress: string) {
  const eventsService = new UniswapEventsService(API_KEY);

  const [mints, burns, collects] = await Promise.all([
    eventsService.getMintEvents({ owner: userAddress, first: 1000 }),
    eventsService.getBurnEvents({ owner: userAddress, first: 1000 }),
    eventsService.getCollectEvents({ owner: userAddress, first: 1000 })
  ]);

  console.log(`用户 ${userAddress} 的活动统计:`);
  console.log(`- 添加流动性: ${mints.length} 次`);
  console.log(`- 移除流动性: ${burns.length} 次`);
  console.log(`- 收取手续费: ${collects.length} 次`);

  // 计算总投入和收益
  const totalInvested = mints.reduce((sum, mint) =>
    sum + parseFloat(mint.amountUSD), 0
  );
  const totalWithdrawn = burns.reduce((sum, burn) =>
    sum + parseFloat(burn.amountUSD), 0
  );
  const totalFeesCollected = collects.reduce((sum, collect) =>
    sum + parseFloat(collect.amountUSD), 0
  );

  console.log(`- 总投入: $${totalInvested.toFixed(2)}`);
  console.log(`- 总提取: $${totalWithdrawn.toFixed(2)}`);
  console.log(`- 收取手续费: $${totalFeesCollected.toFixed(2)}`);
}
```