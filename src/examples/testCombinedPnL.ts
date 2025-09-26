import { SwapPnLService } from '../services/swapPnL';
import { UniswapPositionsService } from '../services/uniswapPositions';
import { HistoricalPriceService } from '../services/historicalPriceService';

interface Operation {
  timestamp: number;
  date: string;
  type: 'SWAP' | 'POSITION_OPEN' | 'POSITION_CLOSE';
  description: string;
  usdtChange: number;
  ethChange: number;
  cumulativeUSDT: number;
  cumulativeETH: number;
  bnbPrice: number;
  totalUSDValue: number;
  details: any;
}


interface CombinedPnLData {
  swapPnL: {
    netUSDT: number;
    netETH: number;
    avgPrice: number;
    totalGasCost: number;
    transactionCount: number;
  };
  positionPnL: {
    netToken0: number;
    netToken1: number;
    avgPrice: number;
    totalFeesToken0: number;
    totalFeesToken1: number;
    closedPositions: number;
  };
  combined: {
    totalNetUSDT: number;
    totalNetETH: number;
    combinedAvgPrice: number;
    totalProfit: number;
    totalGasCost: number;
  };
  timeline: Operation[];
}


async function testCombinedPnL() {
  // API配置
  const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'KZTJ9PU5MJRPR8D1XX7VQKEE6UJTWWXGEA';
  const UNISWAP_API_KEY = 'be2ae915f456d6ac0497f3ac60ef43b2';

  // 测试地址
  const testAddress = '0x6D530C88f583478fdc2E553F872bbe6dDd89c7Ee';

  // 初始化服务
  const swapService = new SwapPnLService(
    ETHERSCAN_API_KEY,
    'https://bsc-mainnet.nodereal.io/v1/3611e830855047a3956d4ba3f641a769'
  );
  const positionsService = new UniswapPositionsService(UNISWAP_API_KEY);
  const priceService = new HistoricalPriceService();

  try {
    console.log('🔍 Combined PnL Analysis for:', testAddress);
    console.log('=' .repeat(80));

    // 1. 获取Swap PnL数据
    console.log('\n📊 Step 1: Analyzing Swap Transactions...');
    const startBlock = 60121380;
    const swapPnLData = await swapService.getSwapPnLData(testAddress, startBlock);

    // 查找USDT和ETH数据
    const USDT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';
    const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    let usdtSummary = null;
    let ethSummary = null;

    for (const [address, summary] of Object.entries(swapPnLData.tokenSummary)) {
      if (address.toLowerCase().includes('55d398') || address.toLowerCase().includes('usdt')) {
        usdtSummary = summary;
      }
      if (address.toLowerCase().includes('eeeeee') || address.toLowerCase().includes('eth')) {
        ethSummary = summary;
      }
    }

    const swapNetUSDT = usdtSummary ? parseFloat(swapService.formatTokenAmount(usdtSummary.netAmount.toString(), 18)) : 0;
    const swapNetETH = ethSummary ? parseFloat(swapService.formatTokenAmount(ethSummary.netAmount.toString(), 18)) : 0;
    const swapAvgPrice = swapNetETH !== 0 ? Math.abs(swapNetUSDT / swapNetETH) : 0;
    const swapGasCost = parseFloat(swapService.formatEther(swapPnLData.totalGasCost.toString()));

    console.log(`   Swap Net USDT: ${swapNetUSDT.toFixed(2)}`);
    console.log(`   Swap Net ETH: ${swapNetETH.toFixed(6)}`);
    console.log(`   Swap Avg Price: $${swapAvgPrice.toFixed(2)}`);
    console.log(`   Swap Transactions: ${swapPnLData.transactions.length}`);

    // 2. 获取Positions PnL数据
    console.log('\n📈 Step 2: Analyzing Uniswap Positions...');
    const allPositions = await positionsService.getPositions({
      owner: testAddress,
      first: 1000
    });

    // 打印最新positions详情
    const sortedByTime = allPositions.sort((a, b) => parseInt(b.transaction.timestamp) - parseInt(a.transaction.timestamp));
    console.log('\n📋 Latest Positions Details:');
    for (let i = 0; i < Math.min(5, sortedByTime.length); i++) {
      const pos = sortedByTime[i];
      const timestamp = parseInt(pos.transaction.timestamp);
      const date = new Date(timestamp * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const isActive = parseFloat(pos.liquidity) > 0;

      console.log(`   Position #${pos.id}:`);
      console.log(`     Created: ${date} UTC`);
      console.log(`     Pool: ${pos.pool.token0.symbol}/${pos.pool.token1.symbol}`);
      console.log(`     Status: ${isActive ? 'ACTIVE' : 'CLOSED'}`);
      console.log(`     Deposited: ${parseFloat(pos.depositedToken0).toFixed(2)} ${pos.pool.token0.symbol} + ${parseFloat(pos.depositedToken1).toFixed(6)} ${pos.pool.token1.symbol}`);
      console.log(`     Withdrawn: ${parseFloat(pos.withdrawnToken0).toFixed(2)} ${pos.pool.token0.symbol} + ${parseFloat(pos.withdrawnToken1).toFixed(6)} ${pos.pool.token1.symbol}`);
      console.log(`     Fees: ${parseFloat(pos.collectedFeesToken0).toFixed(2)} ${pos.pool.token0.symbol} + ${parseFloat(pos.collectedFeesToken1).toFixed(6)} ${pos.pool.token1.symbol}`);
      console.log('     ---');
    }

    const targetTokenId = 655318;
    const positions = allPositions.filter(position => parseInt(position.id) >= targetTokenId);

    console.log(`   All positions count: ${allPositions.length}`);
    console.log(`   Filtered positions (>= ${targetTokenId}): ${positions.length}`);

    // 显示最新的几个position IDs
    const positionsByIdDesc = allPositions.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    console.log(`   Latest position IDs: ${positionsByIdDesc.slice(0, 5).map(p => p.id).join(', ')}`);

    // 检查是否有9月26日的positions
    const recent = allPositions.filter(p => {
      const timestamp = parseInt(p.transaction.timestamp);
      const date = new Date(timestamp * 1000);
      return date >= new Date('2025-09-26T00:00:00Z');
    });
    console.log(`   Positions from 9/26: ${recent.length} (IDs: ${recent.map(p => p.id).join(', ')})`);

    if (recent.length > 0 && parseInt(recent[0].id) > targetTokenId) {
      console.log(`   ⚠️  Newer positions detected! Consider updating targetTokenId to include recent activity`);
    }

    // 计算positions汇总数据
    const positionSummary = positions.reduce((acc, position) => {
      const deposited0 = parseFloat(position.depositedToken0) || 0;
      const deposited1 = parseFloat(position.depositedToken1) || 0;
      const withdrawn0 = parseFloat(position.withdrawnToken0) || 0;
      const withdrawn1 = parseFloat(position.withdrawnToken1) || 0;
      const fees0 = parseFloat(position.collectedFeesToken0) || 0;
      const fees1 = parseFloat(position.collectedFeesToken1) || 0;
      const isActive = parseFloat(position.liquidity) > 0 && withdrawn0 === 0 && withdrawn1 === 0;
      const isClosed = !isActive;

      return {
        closedPositions: acc.closedPositions + (isClosed ? 1 : 0),
        totalFees0: acc.totalFees0 + (isClosed ? fees0 : 0),
        totalFees1: acc.totalFees1 + (isClosed ? fees1 : 0),
        netPnL0: acc.netPnL0 + (isClosed ? (withdrawn0 + fees0 - deposited0) : 0),
        netPnL1: acc.netPnL1 + (isClosed ? (withdrawn1 + fees1 - deposited1) : 0)
      };
    }, {
      closedPositions: 0,
      totalFees0: 0,
      totalFees1: 0,
      netPnL0: 0,
      netPnL1: 0
    });

    const positionAvgPrice = positionSummary.netPnL1 !== 0 ? Math.abs(positionSummary.netPnL0 / positionSummary.netPnL1) : 0;

    console.log(`   Position Net Token0 (USDT): ${positionSummary.netPnL0.toFixed(2)}`);
    console.log(`   Position Net Token1 (WBNB): ${positionSummary.netPnL1.toFixed(6)}`);
    console.log(`   Position Avg Price: $${positionAvgPrice.toFixed(2)}`);
    console.log(`   Closed Positions: ${positionSummary.closedPositions}`);

    // 3. 时间序列分析
    console.log('\n📈 Step 3: Timeline Analysis...');

    const operations: Operation[] = [];

    // 添加所有swap交易操作
    for (const tx of swapPnLData.transactions) {
      const timestamp = parseInt(tx.timestamp);
      const fromTokenLower = tx.fromToken.toLowerCase();
      const toTokenLower = tx.toToken.toLowerCase();
      const usdtLower = USDT_ADDRESS.toLowerCase();
      const ethLower = ETH_ADDRESS.toLowerCase();

      let usdtChange = 0;
      let ethChange = 0;
      let description = '';

      if (fromTokenLower === usdtLower && toTokenLower === ethLower) {
        // USDT -> ETH (买入)
        usdtChange = -parseFloat(swapService.formatTokenAmount(tx.fromAmount, 18));
        ethChange = parseFloat(swapService.formatTokenAmount(tx.returnAmount, 18));
        description = `BUY ETH: ${Math.abs(usdtChange).toFixed(2)} USDT → ${ethChange.toFixed(6)} ETH`;
      } else if (fromTokenLower === ethLower && toTokenLower === usdtLower) {
        // ETH -> USDT (卖出)
        ethChange = -parseFloat(swapService.formatTokenAmount(tx.fromAmount, 18));
        usdtChange = parseFloat(swapService.formatTokenAmount(tx.returnAmount, 18));
        description = `SELL ETH: ${Math.abs(ethChange).toFixed(6)} ETH → ${usdtChange.toFixed(2)} USDT`;
      } else if (toTokenLower === ethLower || toTokenLower.includes('eth')) {
        // 其他 -> ETH (买入ETH)
        ethChange = parseFloat(swapService.formatTokenAmount(tx.returnAmount, 18));
        description = `BUY ETH: +${ethChange.toFixed(6)} ETH`;
      } else if (fromTokenLower === ethLower || fromTokenLower.includes('eth')) {
        // ETH -> 其他 (卖出ETH)
        ethChange = -parseFloat(swapService.formatTokenAmount(tx.fromAmount, 18));
        description = `SELL ETH: ${Math.abs(ethChange).toFixed(6)} ETH`;
      } else {
        description = `SWAP: ${tx.fromToken.slice(0, 8)} → ${tx.toToken.slice(0, 8)}`;
      }

      operations.push({
        timestamp,
        date: new Date(timestamp * 1000).toISOString().slice(0, 19).replace('T', ' '),
        type: 'SWAP',
        description,
        usdtChange,
        ethChange,
        cumulativeUSDT: 0, // 稍后计算
        cumulativeETH: 0,  // 稍后计算
        bnbPrice: 0, // 稍后计算
        totalUSDValue: 0, // 稍后计算
        details: { txHash: tx.transactionHash, gasUsed: tx.gasUsed }
      });
    }

    // 先按创建时间排序positions，便于确定关仓时间
    const sortedPositions = positions.sort((a, b) => parseInt(a.transaction.timestamp) - parseInt(b.transaction.timestamp));

    // 添加所有position操作
    for (let i = 0; i < sortedPositions.length; i++) {
      const position = sortedPositions[i];
      const timestamp = parseInt(position.transaction.timestamp);
      const deposited0 = parseFloat(position.depositedToken0) || 0;
      const deposited1 = parseFloat(position.depositedToken1) || 0;
      const withdrawn0 = parseFloat(position.withdrawnToken0) || 0;
      const withdrawn1 = parseFloat(position.withdrawnToken1) || 0;
      const fees0 = parseFloat(position.collectedFeesToken0) || 0;
      const fees1 = parseFloat(position.collectedFeesToken1) || 0;

      // 开仓操作
      if (deposited0 > 0 || deposited1 > 0) {
        operations.push({
          timestamp,
          date: new Date(timestamp * 1000).toISOString().slice(0, 19).replace('T', ' '),
          type: 'POSITION_OPEN',
          description: `OPEN LP #${position.id}: -${deposited0.toFixed(2)} USDT, -${deposited1.toFixed(6)} WBNB`,
          usdtChange: -deposited0,
          ethChange: -deposited1,
          cumulativeUSDT: 0,
          cumulativeETH: 0,
          bnbPrice: 0, // 稍后计算
          totalUSDValue: 0, // 稍后计算
          details: { positionId: position.id, tickRange: [position.tickLower.tickIdx, position.tickUpper.tickIdx] }
        });
      }

      // 关仓操作（如果有取出资金）
      if (withdrawn0 > 0 || withdrawn1 > 0 || fees0 > 0 || fees1 > 0) {
        const totalOut0 = withdrawn0 + fees0;
        const totalOut1 = withdrawn1 + fees1;

        // 确定关仓时间：下一个position的开仓时间，如果没有则为当前时间
        let closeTimestamp: number;
        if (i + 1 < sortedPositions.length) {
          // 使用下一个position的创建时间
          closeTimestamp = parseInt(sortedPositions[i + 1].transaction.timestamp);
        } else {
          // 最后一个position，使用当前时间
          closeTimestamp = Math.floor(Date.now() / 1000);
        }

        operations.push({
          timestamp: closeTimestamp,
          date: new Date(closeTimestamp * 1000).toISOString().slice(0, 19).replace('T', ' '),
          type: 'POSITION_CLOSE',
          description: `CLOSE LP #${position.id}: +${totalOut0.toFixed(2)} USDT, +${totalOut1.toFixed(6)} WBNB (fees: ${fees0.toFixed(2)}/${fees1.toFixed(6)})`,
          usdtChange: totalOut0,
          ethChange: totalOut1,
          cumulativeUSDT: 0,
          cumulativeETH: 0,
          bnbPrice: 0, // 稍后计算
          totalUSDValue: 0, // 稍后计算
          details: { positionId: position.id, fees0, fees1, withdrawn0, withdrawn1, originalOpenTime: timestamp }
        });
      }
    }

    // 手动添加初始swap交易（按850 USDT/BNB购入90 BNB）
    const initialSwap = {
      timestamp: Math.floor(new Date('2025-09-05T00:00:00Z').getTime() / 1000), // 9月5日00:00 UTC
      date: '', // 稍后设置
      type: 'SWAP' as const,
      description: 'Manual: BUY BNB: 76500.00 USDT → 90.000000 BNB',
      usdtChange: -76500, // 花费76500 USDT
      ethChange: 90, // 获得90 BNB
      cumulativeUSDT: 0,
      cumulativeETH: 0,
      bnbPrice: 850, // 当时价格850 USDT/BNB
      totalUSDValue: 0,
      details: { txHash: 'manual_initial_swap', gasUsed: '0', manual: true }
    };

    // 设置日期
    initialSwap.date = new Date(initialSwap.timestamp * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // 添加到operations数组开头
    operations.unshift(initialSwap);

    console.log(`   Added manual initial swap: ${initialSwap.description}`);

    // 按时间戳排序
    operations.sort((a, b) => a.timestamp - b.timestamp);

    // 获取价格范围
    if (operations.length === 0) {
      console.log('   No operations found');
      return;
    }

    const startTime = operations[0].timestamp;
    const originalEndTime = operations[operations.length - 1].timestamp;

    // 扩展结束时间到今天，确保有最新价格数据用于分析
    const now = Math.floor(Date.now() / 1000);
    const endTime = Math.max(originalEndTime, now);

    console.log(`   Operations time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(originalEndTime * 1000).toISOString()}`);
    console.log(`   Price data range (extended): ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);

    // 获取BNB/USDT历史价格数据
    // cspell: disable-next-line
    const bnbPriceData = await priceService.getHistoricalPrices('BNBUSDT', startTime, endTime);

    // 计算累计PnL和真实USD价值
    let cumulativeUSDT = 0;
    let cumulativeETH = 0;

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      cumulativeUSDT += op.usdtChange;
      cumulativeETH += op.ethChange;
      op.cumulativeUSDT = cumulativeUSDT;
      op.cumulativeETH = cumulativeETH;

      // 获取当时的BNB价格 (为前几个操作启用调试)
      const shouldDebug = i < 3;
      op.bnbPrice = priceService.getPriceAtTimestamp(bnbPriceData, op.timestamp, shouldDebug);

      if (shouldDebug) {
        console.log(`   Operation #${i + 1}: ${op.description} at ${op.date} - Price: $${op.bnbPrice.toFixed(2)}`);
      }

      // 计算总USD价值 = USDT + (BNB数量 * BNB价格)
      op.totalUSDValue = cumulativeUSDT + (cumulativeETH * op.bnbPrice);
    }

    console.log(`   Total operations found: ${operations.length}`);

    // 4. 合并计算
    console.log('\n🔄 Step 4: Combined Analysis...');

    // 合并净持仓（注意：这里假设Token0是USDT，Token1是ETH/WBNB）
    const totalNetUSDT = swapNetUSDT + positionSummary.netPnL0;
    const totalNetETH = swapNetETH + positionSummary.netPnL1;
    const combinedAvgPrice = totalNetETH !== 0 ? Math.abs(totalNetUSDT / totalNetETH) : 0;

    // 估算总盈亏（以当前ETH价格约$2500计算）
    const estimatedETHPrice = 2500; // 这里应该从API获取实时价格
    const totalProfitUSD = totalNetUSDT + (totalNetETH * estimatedETHPrice);

    // 创建综合数据
    const combinedData: CombinedPnLData = {
      swapPnL: {
        netUSDT: swapNetUSDT,
        netETH: swapNetETH,
        avgPrice: swapAvgPrice,
        totalGasCost: swapGasCost,
        transactionCount: swapPnLData.transactions.length
      },
      positionPnL: {
        netToken0: positionSummary.netPnL0,
        netToken1: positionSummary.netPnL1,
        avgPrice: positionAvgPrice,
        totalFeesToken0: positionSummary.totalFees0,
        totalFeesToken1: positionSummary.totalFees1,
        closedPositions: positionSummary.closedPositions
      },
      combined: {
        totalNetUSDT: totalNetUSDT,
        totalNetETH: totalNetETH,
        combinedAvgPrice: combinedAvgPrice,
        totalProfit: totalProfitUSD,
        totalGasCost: swapGasCost
      },
      timeline: operations
    };

    // 4. 显示综合结果
    console.log('\n💰 Combined PnL Summary:');
    console.table([
      {
        'Category': 'Swap Trading',
        'Net USDT': swapNetUSDT.toFixed(2),
        'Net ETH/WBNB': swapNetETH.toFixed(6),
        'Avg Price': `$${swapAvgPrice.toFixed(2)}`,
        'Transactions/Positions': swapPnLData.transactions.length
      },
      {
        'Category': 'LP Positions',
        'Net USDT': positionSummary.netPnL0.toFixed(2),
        'Net ETH/WBNB': positionSummary.netPnL1.toFixed(6),
        'Avg Price': `$${positionAvgPrice.toFixed(2)}`,
        'Transactions/Positions': positionSummary.closedPositions
      },
      {
        'Category': '🔥 COMBINED TOTAL',
        'Net USDT': totalNetUSDT.toFixed(2),
        'Net ETH/WBNB': totalNetETH.toFixed(6),
        'Avg Price': `$${combinedAvgPrice.toFixed(2)}`,
        'Transactions/Positions': `${swapPnLData.transactions.length + positionSummary.closedPositions}`
      }
    ]);

    console.log('\n📊 Detailed Analysis:');
    console.table([
      { 'Metric': 'Total Net USDT', 'Value': `${totalNetUSDT.toFixed(2)} USDT` },
      { 'Metric': 'Total Net ETH/WBNB', 'Value': `${totalNetETH.toFixed(6)} ETH/WBNB` },
      { 'Metric': 'Combined Average Price', 'Value': `$${combinedAvgPrice.toFixed(2)}` },
      { 'Metric': 'Estimated Total P&L (USD)', 'Value': `$${totalProfitUSD.toFixed(2)}` },
      { 'Metric': 'Total Gas Costs', 'Value': `${swapGasCost.toFixed(6)} ETH` },
      { 'Metric': 'LP Fees Earned (USDT)', 'Value': `${positionSummary.totalFees0.toFixed(2)} USDT` },
      { 'Metric': 'LP Fees Earned (ETH/WBNB)', 'Value': `${positionSummary.totalFees1.toFixed(6)} ETH/WBNB` }
    ]);

    // 5. 时间序列PnL曲线
    console.log('\n📈 Timeline: PnL Evolution Over Time');
    console.log('=' .repeat(120));

    console.table(
      operations.map((op, index) => {
        // 计算当前累计均价
        const currentAvgPrice = op.cumulativeETH !== 0 ?
          Math.abs(op.cumulativeUSDT / op.cumulativeETH).toFixed(2) : 'N/A';

        const row: any = {
          '#': index + 1,
          'Date (UTC)': op.date,
          'Type': op.type,
          'Description': op.description.length > 40 ? op.description.slice(0, 37) + '...' : op.description,
          'USDT Δ': op.usdtChange.toFixed(2),
          'BNB Δ': op.ethChange.toFixed(6),
          'Cum. USDT': op.cumulativeUSDT.toFixed(2),
          'Cum. BNB': op.cumulativeETH.toFixed(6),
          'BNB Price': `$${op.bnbPrice.toFixed(2)}`,
          'Avg Cost': currentAvgPrice !== 'N/A' ? `$${currentAvgPrice}` : currentAvgPrice
        };

        // 只在POSITION_CLOSE时显示Total USD
        if (op.type === 'POSITION_CLOSE') {
          row['Total USD'] = `$${op.totalUSDValue.toFixed(2)}`;
        } else {
          row['Total USD'] = '';
        }

        return row;
      })
    );

    // 显示关键节点统计
    console.log('\n📊 Timeline Key Statistics:');
    const swapOps = operations.filter(op => op.type === 'SWAP');
    const openOps = operations.filter(op => op.type === 'POSITION_OPEN');
    const closeOps = operations.filter(op => op.type === 'POSITION_CLOSE');

    console.table([
      { 'Operation Type': 'SWAP Transactions', 'Count': swapOps.length, 'USDT Impact': swapOps.reduce((sum, op) => sum + op.usdtChange, 0).toFixed(2), 'ETH Impact': swapOps.reduce((sum, op) => sum + op.ethChange, 0).toFixed(6) },
      { 'Operation Type': 'LP Position Opens', 'Count': openOps.length, 'USDT Impact': openOps.reduce((sum, op) => sum + op.usdtChange, 0).toFixed(2), 'ETH Impact': openOps.reduce((sum, op) => sum + op.ethChange, 0).toFixed(6) },
      { 'Operation Type': 'LP Position Closes', 'Count': closeOps.length, 'USDT Impact': closeOps.reduce((sum, op) => sum + op.usdtChange, 0).toFixed(2), 'ETH Impact': closeOps.reduce((sum, op) => sum + op.ethChange, 0).toFixed(6) },
      { 'Operation Type': '🔥 TOTAL', 'Count': operations.length, 'USDT Impact': totalNetUSDT.toFixed(2), 'ETH Impact': totalNetETH.toFixed(6) }
    ]);

    // PnL趋势分析
    if (operations.length > 0) {
      const initialValue = operations[0].totalUSDValue;
      const finalValue = operations[operations.length - 1].totalUSDValue;
      const maxValue = Math.max(...operations.map(op => op.totalUSDValue));
      const minValue = Math.min(...operations.map(op => op.totalUSDValue));

      console.log('\n🎯 PnL Trend Analysis:');
      console.table([
        { 'Metric': 'Initial Portfolio Value', 'Value': `$${initialValue.toFixed(2)}` },
        { 'Metric': 'Final Portfolio Value', 'Value': `$${finalValue.toFixed(2)}` },
        { 'Metric': 'Maximum Value Reached', 'Value': `$${maxValue.toFixed(2)}` },
        { 'Metric': 'Minimum Value Reached', 'Value': `$${minValue.toFixed(2)}` },
        { 'Metric': 'Total P&L (USD)', 'Value': `$${(finalValue - initialValue).toFixed(2)}` },
        { 'Metric': 'Max Drawdown', 'Value': `$${(maxValue - minValue).toFixed(2)}` },
        { 'Metric': 'ROI (%)', 'Value': `${initialValue !== 0 ? ((finalValue - initialValue) / Math.abs(initialValue) * 100).toFixed(2) : 'N/A'}%` }
      ]);

      // 找到最大盈利和最大亏损的时间点
      const maxValueOp = operations.find(op => op.totalUSDValue === maxValue);
      const minValueOp = operations.find(op => op.totalUSDValue === minValue);

      console.log('\n📈 Key Moments:');
      if (maxValueOp) {
        console.log(`   🎉 Peak Value: $${maxValue.toFixed(2)} at ${maxValueOp.date} (${maxValueOp.description})`);
      }
      if (minValueOp) {
        console.log(`   📉 Lowest Value: $${minValue.toFixed(2)} at ${minValueOp.date} (${minValueOp.description})`);
      }

      // 显示当前市值（基于最新BNB价格）
      if (bnbPriceData.length > 0) {
        const currentBNBPrice = bnbPriceData[bnbPriceData.length - 1].price;
        const currentMarketValue = totalNetUSDT + (totalNetETH * currentBNBPrice);

        console.log(`\n💎 Current Market Value Analysis:`);
        console.log(`   Current BNB Price: $${currentBNBPrice.toFixed(2)}`);
        console.log(`   Current Portfolio Value: $${currentMarketValue.toFixed(2)}`);
        console.log(`   Unrealized P&L: $${(currentMarketValue - finalValue).toFixed(2)}`);
      }
    }

    console.log('\n⚠️  Notes:');
    console.log('   • Timeline shows chronological order of all operations (Swaps + LP positions)');
    console.log('   • BNB prices fetched from Binance API (1-minute resolution)');
    console.log('   • Total USD = Cum. USDT + (Cum. BNB × BNB Price at that time)');
    console.log('   • Portfolio value calculated using historical BNB prices');
    console.log('   • Combined analysis assumes Token0 = USDT, Token1 = BNB/WBNB');
    console.log('   • Gas costs are in BNB and should be converted to USD for accurate P&L');
    console.log('   • LP positions analysis includes only closed positions');
    console.log('   • Negative USDT Δ = spending USDT, Positive BNB Δ = gaining BNB');

    console.log('\n🎯 Timeline Legend:');
    console.log('   • USDT Δ: Change in USDT balance (+gain/-spend)');
    console.log('   • BNB Δ: Change in BNB balance (+gain/-spend)');
    console.log('   • Cum. USDT: Running total of USDT balance');
    console.log('   • Cum. BNB: Running total of BNB balance');
    console.log('   • BNB Price: Historical BNB/USDT price from Binance');
    console.log('   • Total USD: Real portfolio value = USDT + (BNB × BNB Price)');
    console.log('   • Avg Cost: |Cumulative USDT| / |Cumulative BNB| average cost price');

    return combinedData;

  } catch (error) {
    console.error('❌ Combined PnL analysis failed:', error);
    throw error;
  }
}

// 运行测试
testCombinedPnL();

export { testCombinedPnL };
export type { CombinedPnLData };