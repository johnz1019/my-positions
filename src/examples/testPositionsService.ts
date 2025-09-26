import { UniswapPositionsService } from '../services/uniswapPositions';

async function testUniswapPositionsService() {
  const API_KEY = 'be2ae915f456d6ac0497f3ac60ef43b2';

  const positionsService = new UniswapPositionsService(API_KEY);

  // 使用一个有实际交易记录的地址进行测试
  const testAddress = '0x6D530C88f583478fdc2E553F872bbe6dDd89c7Ee';

  try {
    console.log('Testing Uniswap Positions Service...\n');

    console.log('1. Fetching user positions...');
    const allPositions = await positionsService.getPositions({
      owner: testAddress,
      first: 1000 // 获取更多位置来过滤
    });

    // 过滤出 tokenId >= 655318 的位置
    const targetTokenId = 655318;
    const positions = allPositions.filter(position => parseInt(position.id) >= targetTokenId);

    console.log(`Found ${allPositions.length} total positions, ${positions.length} positions with ID >= ${targetTokenId}`);

    if (positions.length > 0) {
      console.log('\nSample position:');
      const samplePosition = positions[0];
      console.log(`Position ID: ${samplePosition.id}`);
      console.log(`Pool: ${samplePosition.pool.token0.symbol}/${samplePosition.pool.token1.symbol}`);
      console.log(`Liquidity: ${samplePosition.liquidity}`);
      console.log(`Deposited: ${samplePosition.depositedToken0} ${samplePosition.pool.token0.symbol} + ${samplePosition.depositedToken1} ${samplePosition.pool.token1.symbol}`);
      console.log(`Withdrawn: ${samplePosition.withdrawnToken0} ${samplePosition.pool.token0.symbol} + ${samplePosition.withdrawnToken1} ${samplePosition.pool.token1.symbol}`);
      console.log(`Collected Fees: ${samplePosition.collectedFeesToken0} ${samplePosition.pool.token0.symbol} + ${samplePosition.collectedFeesToken1} ${samplePosition.pool.token1.symbol}`);
      console.log(`Tick Range: [${samplePosition.tickLower.tickIdx}, ${samplePosition.tickUpper.tickIdx}]`);
      const createdAt = new Date(parseInt(samplePosition.transaction.timestamp) * 1000);
      createdAt.setHours(createdAt.getHours() + 8); // UTC+8
      console.log(`Created at: ${createdAt.toISOString().replace('T', ' ').replace('Z', ' (UTC+8)')}`);
    }

    console.log('\n2. Analyzing filtered positions...');

    // 计算过滤后的统计信息
    const activePositions = positions.filter(p => parseFloat(p.liquidity) > 0);
    const totalFees = positions.reduce((acc, position) => {
      const fees0 = parseFloat(position.collectedFeesToken0) || 0;
      const fees1 = parseFloat(position.collectedFeesToken1) || 0;
      return {
        totalFeesToken0: acc.totalFeesToken0 + fees0,
        totalFeesToken1: acc.totalFeesToken1 + fees1
      };
    }, { totalFeesToken0: 0, totalFeesToken1: 0 });

    console.log(`Positions with ID >= ${targetTokenId}:`);
    console.log(`- Total positions: ${positions.length}`);
    console.log(`- Active positions: ${activePositions.length}`);
    console.log(`- Total fees collected: ${totalFees.totalFeesToken0.toFixed(6)} Token0 + ${totalFees.totalFeesToken1.toFixed(6)} Token1`);

    console.log('\n3. Position Analysis Table:');
    console.table(
      positions.map(position => {
        const createdAt = new Date(parseInt(position.transaction.timestamp) * 1000);
        createdAt.setHours(createdAt.getHours() + 8); // UTC+8

        const isDestroyed = parseFloat(position.liquidity) === 0 ||
                           parseFloat(position.withdrawnToken0) > 0 ||
                           parseFloat(position.withdrawnToken1) > 0;

        const deposited0 = parseFloat(position.depositedToken0);
        const deposited1 = parseFloat(position.depositedToken1);
        const withdrawn0 = parseFloat(position.withdrawnToken0);
        const withdrawn1 = parseFloat(position.withdrawnToken1);
        const collectedFees0 = parseFloat(position.collectedFeesToken0);
        const collectedFees1 = parseFloat(position.collectedFeesToken1);

        const netToken0 = withdrawn0 + collectedFees0 - deposited0;
        const netToken1 = withdrawn1 + collectedFees1 - deposited1;

        // 计算均价 (Token0/Token1)
        const avgPrice = netToken1 !== 0 ? Math.abs(netToken0 / netToken1).toFixed(2) : 'N/A';

        return {
          'Token ID': position.id,
          'Pool': `${position.pool.token0.symbol}/${position.pool.token1.symbol}`,
          'Status': isDestroyed ? 'CLOSED' : 'ACTIVE',
          'Created (UTC+8)': createdAt.toISOString().slice(0, 19).replace('T', ' '),
          'Fees Token0': collectedFees0.toFixed(2),
          'Fees Token1': collectedFees1.toFixed(6),
          'Net Token0': netToken0.toFixed(2),
          'Net Token1': netToken1.toFixed(6),
          'Avg Price': avgPrice,
          'Deposited Token0': deposited0.toFixed(2),
          'Deposited Token1': deposited1.toFixed(6)
        };
      })
    );

    console.log('\n4. Summary Table (Closed Positions Only):');
    const summary = positions.reduce((acc, position) => {
      const deposited0 = parseFloat(position.depositedToken0) || 0;
      const deposited1 = parseFloat(position.depositedToken1) || 0;
      const withdrawn0 = parseFloat(position.withdrawnToken0) || 0;
      const withdrawn1 = parseFloat(position.withdrawnToken1) || 0;
      const fees0 = parseFloat(position.collectedFeesToken0) || 0;
      const fees1 = parseFloat(position.collectedFeesToken1) || 0;
      const isActive = parseFloat(position.liquidity) > 0 && withdrawn0 === 0 && withdrawn1 === 0;
      const isClosed = !isActive;

      return {
        totalPositions: acc.totalPositions + 1,
        activePositions: acc.activePositions + (isActive ? 1 : 0),
        closedPositions: acc.closedPositions + (isClosed ? 1 : 0),
        // 只统计已关闭位置的资金流
        totalDeposited0: acc.totalDeposited0 + (isClosed ? deposited0 : 0),
        totalDeposited1: acc.totalDeposited1 + (isClosed ? deposited1 : 0),
        totalWithdrawn0: acc.totalWithdrawn0 + (isClosed ? withdrawn0 : 0),
        totalWithdrawn1: acc.totalWithdrawn1 + (isClosed ? withdrawn1 : 0),
        totalFees0: acc.totalFees0 + (isClosed ? fees0 : 0),
        totalFees1: acc.totalFees1 + (isClosed ? fees1 : 0),
        netPnL0: acc.netPnL0 + (isClosed ? (withdrawn0 + fees0 - deposited0) : 0),
        netPnL1: acc.netPnL1 + (isClosed ? (withdrawn1 + fees1 - deposited1) : 0)
      };
    }, {
      totalPositions: 0,
      activePositions: 0,
      closedPositions: 0,
      totalDeposited0: 0,
      totalDeposited1: 0,
      totalWithdrawn0: 0,
      totalWithdrawn1: 0,
      totalFees0: 0,
      totalFees1: 0,
      netPnL0: 0,
      netPnL1: 0
    });

    // 计算总体均价
    const overallAvgPrice = summary.netPnL1 !== 0 ? Math.abs(summary.netPnL0 / summary.netPnL1).toFixed(2) : 'N/A';

    console.table([{
      'Metric': 'Total Positions',
      'Value': summary.totalPositions
    }, {
      'Metric': 'Active Positions',
      'Value': summary.activePositions
    }, {
      'Metric': 'Closed Positions',
      'Value': summary.closedPositions
    }, {
      'Metric': 'Total Deposited Token0 (Closed)',
      'Value': summary.totalDeposited0.toFixed(2)
    }, {
      'Metric': 'Total Deposited Token1 (Closed)',
      'Value': summary.totalDeposited1.toFixed(6)
    }, {
      'Metric': 'Total Withdrawn Token0 (Closed)',
      'Value': summary.totalWithdrawn0.toFixed(2)
    }, {
      'Metric': 'Total Withdrawn Token1 (Closed)',
      'Value': summary.totalWithdrawn1.toFixed(6)
    }, {
      'Metric': 'Total Fees Token0 (Closed)',
      'Value': summary.totalFees0.toFixed(2)
    }, {
      'Metric': 'Total Fees Token1 (Closed)',
      'Value': summary.totalFees1.toFixed(6)
    }, {
      'Metric': 'Net PnL Token0 (Closed)',
      'Value': summary.netPnL0.toFixed(2)
    }, {
      'Metric': 'Net PnL Token1 (Closed)',
      'Value': summary.netPnL1.toFixed(6)
    }, {
      'Metric': 'Overall Avg Price (Token0/Token1)',
      'Value': overallAvgPrice
    }]);


  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUniswapPositionsService();