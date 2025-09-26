import { UniswapEventsService } from '../services/uniswapEvents';

async function testUniswapEventsService() {
  // Note: You need to get an API key from https://thegraph.com/studio/
  const API_KEY = 'be2ae915f456d6ac0497f3ac60ef43b2'

  if (!API_KEY) {
    console.error('Please set THE_GRAPH_API_KEY environment variable');
    console.log('Get an API key from: https://thegraph.com/studio/');
    return;
  }

  const eventsService = new UniswapEventsService(API_KEY);

  // 使用一个有实际交易记录的地址进行测试
  const testAddress = '0x6D530C88f583478fdc2E553F872bbe6dDd89c7Ee';

  try {
    console.log('Testing Uniswap Events Service...\n');

    console.log('1. Fetching positions (NFTs)...');
    const positions = await eventsService.getPositions({
      owner: testAddress,
      first: 10
    });
    console.log(`Found ${positions.length} positions`);
    if (positions.length > 0) {
      console.log('Sample position:', JSON.stringify(positions[0], null, 2));
      console.log('Position IDs:', positions.map(p => p.id));
    }

    if (positions.length === 0) {
      console.log('No positions found for this address. Try a different address.');
      return;
    }

    const positionIds = positions.map(p => p.id);

    console.log('\n2. Fetching increase liquidity events...');
    const increaseLiquidityEvents = await eventsService.getIncreaseLiquidityEvents({
      first: 5
    }, positionIds);
    console.log(`Found ${increaseLiquidityEvents.length} increase liquidity events`);
    if (increaseLiquidityEvents.length > 0) {
      console.log('Sample increase liquidity event:', JSON.stringify(increaseLiquidityEvents[0], null, 2));
    }

    console.log('\n3. Fetching decrease liquidity events...');
    const decreaseLiquidityEvents = await eventsService.getDecreaseLiquidityEvents({
      first: 5
    }, positionIds);
    console.log(`Found ${decreaseLiquidityEvents.length} decrease liquidity events`);
    if (decreaseLiquidityEvents.length > 0) {
      console.log('Sample decrease liquidity event:', JSON.stringify(decreaseLiquidityEvents[0], null, 2));
    }

    console.log('\n4. Fetching collect events...');
    const collectEvents = await eventsService.getCollectEvents({
      first: 5
    }, positionIds);
    console.log(`Found ${collectEvents.length} collect events`);
    if (collectEvents.length > 0) {
      console.log('Sample collect event:', JSON.stringify(collectEvents[0], null, 2));
    }

    console.log('\n5. Fetching all position events...');
    const allEvents = await eventsService.getPositionEvents(testAddress, { first: 10 });
    console.log(`Total events found:`);
    console.log(`- Positions: ${allEvents.positions.length}`);
    console.log(`- Increase Liquidity: ${allEvents.increaseLiquidity.length}`);
    console.log(`- Decrease Liquidity: ${allEvents.decreaseLiquidity.length}`);
    console.log(`- Collects: ${allEvents.collects.length}`);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUniswapEventsService();

export { testUniswapEventsService };