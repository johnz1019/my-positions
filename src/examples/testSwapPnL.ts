import { SwapPnLService } from '../services/swapPnL';

async function testSwapPnLService() {
  // 需要从环境变量或配置中获取 API key
  const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'KZTJ9PU5MJRPR8D1XX7VQKEE6UJTWWXGEA';

  // 测试地址
  const testAddress = '0x6D530C88f583478fdc2E553F872bbe6dDd89c7Ee';

  const swapService = new SwapPnLService(ETHERSCAN_API_KEY, 'https://bsc-mainnet.nodereal.io/v1/3611e830855047a3956d4ba3f641a769');

  try {
    console.log('🔍 Testing Swap PnL Service...\n');

    console.log(`📊 Analyzing swap transactions for address: ${testAddress}\n`);

    // 获取最近的交易（可以调整区块范围）
    const startBlock = 	60121380; // 从较近的区块开始，避免查询过多历史数据
    const pnlData = await swapService.getSwapPnLData(testAddress, startBlock);

    console.log('📈 Swap Analysis Results:');
    console.log('=' .repeat(50));

    console.log(`📋 Transaction Summary:`);
    console.log(`   • Total swap transactions: ${pnlData.transactions.length}`);
    console.log(`   • Profitable swaps: ${pnlData.profitableSwaps}`);
    console.log(`   • Unprofitable swaps: ${pnlData.unprofitableSwaps}`);
    console.log(`   • Total gas cost: ${swapService.formatEther(pnlData.totalGasCost.toString())} ETH`);

    if (pnlData.transactions.length > 0) {
      console.log('\n🔄 Recent Swap Transactions:');
      console.table(
        pnlData.transactions.slice(0, 10).map((tx, index) => ({
          '#': index + 1,
          'Tx Hash': tx.transactionHash.slice(0, 10) + '...',
          'From Token': tx.fromToken.slice(0, 8) + '...',
          'To Token': tx.toToken.slice(0, 8) + '...',
          'From Amount': swapService.formatTokenAmount(tx.fromAmount),
          'Return Amount': swapService.formatTokenAmount(tx.returnAmount),
          'Timestamp': new Date(parseInt(tx.timestamp) * 1000).toISOString().slice(0, 19).replace('T', ' ')
        }))
      );

      console.log('\n💰 Token Summary:');
      const tokenEntries = Object.entries(pnlData.tokenSummary).slice(0, 10);

      for (const [tokenAddress, summary] of tokenEntries) {
        console.log(`\nToken: ${tokenAddress.slice(0, 8)}...`);
        console.log(`  📥 Total In:  ${swapService.formatTokenAmount(summary.totalIn.toString())}`);
        console.log(`  📤 Total Out: ${swapService.formatTokenAmount(summary.totalOut.toString())}`);
        console.log(`  💹 Net:       ${swapService.formatTokenAmount(summary.netAmount.toString())}`);
        console.log(`  🔄 Tx Count:  ${summary.transactionCount}`);
      }

      // 尝试获取一些代币信息
      console.log('\n🪙 Token Information:');
      const uniqueTokens = [...new Set([
        ...pnlData.transactions.slice(0, 5).map(tx => tx.fromToken),
        ...pnlData.transactions.slice(0, 5).map(tx => tx.toToken)
      ])];

      for (const tokenAddress of uniqueTokens.slice(0, 3)) {
        try {
          const tokenInfo = await swapService.getTokenInfo(tokenAddress);
          console.log(`   ${tokenAddress}: ${tokenInfo.symbol} (${tokenInfo.decimals} decimals)`);
        } catch (error) {
          console.log(`   ${tokenAddress}: Unable to fetch token info`);
        }
      }

    } else {
      console.log('\n📝 No swap transactions found for this address in the specified block range.');
      console.log('   Try adjusting the startBlock parameter or check if the address has swap activity.');
    }

    console.log('\n⚠️  Note: This is a basic PnL analysis. For accurate profit calculation,');
    console.log('   you would need historical price data for each token at transaction time.');

  } catch (error: any) {
    console.error('❌ Test failed:', error);

    if (error?.message?.includes('API key')) {
      console.log('\n💡 Make sure to set your Etherscan API key:');
      console.log('   export ETHERSCAN_API_KEY="your_api_key_here"');
      console.log('   Get one from: https://etherscan.io/apis');
    }
  }
}

// 运行测试
testSwapPnLService();

export { testSwapPnLService };