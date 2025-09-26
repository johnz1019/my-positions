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
      console.log('\n🔄 All Swap Transactions:');

      // 定义基础代币和资产代币地址
      const USDT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955'; // BSC USDT
      const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // Native ETH

      console.table(
        pnlData.transactions.map((tx, index) => {
          // 判断买卖方向和计算均价
          const fromTokenLower = tx.fromToken.toLowerCase();
          const toTokenLower = tx.toToken.toLowerCase();
          const usdtLower = USDT_ADDRESS.toLowerCase();
          const ethLower = ETH_ADDRESS.toLowerCase();

          let direction = '';
          let avgPrice = '';

          if (fromTokenLower === usdtLower && toTokenLower === ethLower) {
            // USDT -> ETH = 买入
            direction = 'BUY';
            const usdtAmount = parseFloat(swapService.formatTokenAmount(tx.fromAmount, 18));
            const ethAmount = parseFloat(swapService.formatTokenAmount(tx.returnAmount, 18));
            avgPrice = ethAmount > 0 ? (usdtAmount / ethAmount).toFixed(2) : '0';
          } else if (fromTokenLower === ethLower && toTokenLower === usdtLower) {
            // ETH -> USDT = 卖出
            direction = 'SELL';
            const ethAmount = parseFloat(swapService.formatTokenAmount(tx.fromAmount, 18));
            const usdtAmount = parseFloat(swapService.formatTokenAmount(tx.returnAmount, 18));
            avgPrice = ethAmount > 0 ? (usdtAmount / ethAmount).toFixed(2) : '0';
          } else if (toTokenLower === ethLower || toTokenLower.includes('eth')) {
            // 其他代币 -> ETH类 = 买入ETH
            direction = 'BUY';
            avgPrice = 'N/A';
          } else if (fromTokenLower === ethLower || fromTokenLower.includes('eth')) {
            // ETH类 -> 其他代币 = 卖出ETH
            direction = 'SELL';
            avgPrice = 'N/A';
          } else {
            direction = 'SWAP';
            avgPrice = 'N/A';
          }

          return {
            '#': index + 1,
            'Direction': direction,
            'Tx Hash': tx.transactionHash.slice(0, 10) + '...',
            'From Token': tx.fromToken.slice(0, 8) + '...',
            'To Token': tx.toToken.slice(0, 8) + '...',
            'From Amount': swapService.formatTokenAmount(tx.fromAmount),
            'Return Amount': swapService.formatTokenAmount(tx.returnAmount),
            'Avg Price': avgPrice !== 'N/A' ? `$${avgPrice}` : avgPrice,
            'Timestamp': new Date(parseInt(tx.timestamp) * 1000).toISOString().slice(0, 19).replace('T', ' ')
          };
        })
      );

      console.log('\n💰 Token Summary:');
      const tokenEntries = Object.entries(pnlData.tokenSummary).slice(0, 10);

      // 查找实际的USDT和ETH代币地址
      let usdtSummary = null;
      let ethSummary = null;

      for (const [address, summary] of Object.entries(pnlData.tokenSummary)) {
        if (address.toLowerCase().includes('55d398') || address.toLowerCase().includes('usdt')) {
          usdtSummary = summary;
        }
        if (address.toLowerCase().includes('eeeeee') || address.toLowerCase().includes('eth')) {
          ethSummary = summary;
        }
      }

      const calculateNetAvgPrice = () => {
        if (!usdtSummary || !ethSummary) return 'N/A';

        const usdtNetFloat = parseFloat(swapService.formatTokenAmount(usdtSummary.netAmount.toString(), 18));
        const ethNetFloat = parseFloat(swapService.formatTokenAmount(ethSummary.netAmount.toString(), 18));

        if (ethNetFloat === 0) return 'N/A';
        return Math.abs(usdtNetFloat / ethNetFloat).toFixed(2);
      };

      const netAvgPrice = calculateNetAvgPrice();

      // 先显示净均价信息
      console.log(`\n📊 Net Average Price (USDT/ETH): ${netAvgPrice !== 'N/A' ? `$${netAvgPrice}` : netAvgPrice}`);
      if (usdtSummary) console.log(`   USDT Net: ${swapService.formatTokenAmount(usdtSummary.netAmount.toString(), 18)}`);
      if (ethSummary) console.log(`   ETH Net: ${swapService.formatTokenAmount(ethSummary.netAmount.toString(), 18)}`);

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