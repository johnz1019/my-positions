import { request, gql } from 'graphql-request';

const UNISWAP_V3_SUBGRAPH_URL = 'https://gateway.thegraph.com/api/subgraphs/id/G5MUbSBM7Nsrm9tH2tGQUiAF4SZDGf2qeo1xPLYjKr7K';

export interface Position {
  id: string;
  owner: string;
  pool: {
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
  };
  tickLower: {
    tickIdx: string;
  };
  tickUpper: {
    tickIdx: string;
  };
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  transaction: {
    id: string;
    timestamp: string;
  };
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
}

export interface IncreaseLiquidityEvent {
  id: string;
  transaction: {
    id: string;
    timestamp: string;
    blockNumber: string;
  };
  position: {
    id: string;
  };
  amount0: string;
  amount1: string;
  liquidity: string;
}

export interface DecreaseLiquidityEvent {
  id: string;
  transaction: {
    id: string;
    timestamp: string;
    blockNumber: string;
  };
  position: {
    id: string;
  };
  amount0: string;
  amount1: string;
  liquidity: string;
}

export interface MintEvent {
  id: string;
  transaction: {
    id: string;
    timestamp: string;
    blockNumber: string;
  };
  pool: {
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
  };
  owner: string;
  sender: string;
  origin: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  tickLower: string;
  tickUpper: string;
  logIndex: string;
}

export interface BurnEvent {
  id: string;
  transaction: {
    id: string;
    timestamp: string;
    blockNumber: string;
  };
  pool: {
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
  };
  owner: string;
  origin: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  tickLower: string;
  tickUpper: string;
  logIndex: string;
}

export interface CollectEvent {
  id: string;
  transaction: {
    id: string;
    timestamp: string;
    blockNumber: string;
  };
  pool: {
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
      decimals: string;
    };
  };
  owner: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  tickLower: string;
  tickUpper: string;
  logIndex: string;
}

export interface UniswapEventsResponse {
  positions: Position[];
  increaseLiquidity: IncreaseLiquidityEvent[];
  decreaseLiquidity: DecreaseLiquidityEvent[];
  collects: CollectEvent[];
}

export interface EventsFilter {
  owner?: string;
  sender?: string;
  pool?: string;
  position?: string;
  positions?: string[];
  first?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  timestampGte?: number;
  timestampLte?: number;
}

const POSITIONS_QUERY = gql`
  query GetPositions($first: Int, $skip: Int, $orderBy: String, $orderDirection: String, $whereOwner: String) {
    positions(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { owner: $whereOwner }
    ) {
      id
      owner
      pool {
        id
        token0 {
          id
          symbol
          name
          decimals
        }
        token1 {
          id
          symbol
          name
          decimals
        }
      }
      tickLower {
        tickIdx
      }
      tickUpper {
        tickIdx
      }
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      collectedFeesToken0
      collectedFeesToken1
      transaction {
        id
        timestamp
      }
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
    }
  }
`;

const INCREASE_LIQUIDITY_QUERY = gql`
  query GetIncreaseLiquidity($first: Int, $skip: Int, $orderBy: String, $orderDirection: String, $wherePositions: [String!]) {
    mints(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { token_in: $wherePositions }
    ) {
      id
      transaction {
        id
        timestamp
        blockNumber
      }
      token
      amount0
      amount1
      amount
    }
  }
`;

const DECREASE_LIQUIDITY_QUERY = gql`
  query GetDecreaseLiquidity($first: Int, $skip: Int, $orderBy: String, $orderDirection: String, $wherePositions: [String!]) {
    burns(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { token_in: $wherePositions }
    ) {
      id
      transaction {
        id
        timestamp
        blockNumber
      }
      token
      amount0
      amount1
      amount
    }
  }
`;

const BURN_EVENTS_QUERY = gql`
  query GetBurns($first: Int, $skip: Int, $orderBy: String, $orderDirection: String, $whereOwner: String) {
    burns(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { owner: $whereOwner }
    ) {
      id
      transaction {
        id
        timestamp
        blockNumber
      }
      pool {
        id
        token0 {
          id
          symbol
          name
          decimals
        }
        token1 {
          id
          symbol
          name
          decimals
        }
      }
      owner
      origin
      amount
      amount0
      amount1
      amountUSD
      tickLower
      tickUpper
      logIndex
    }
  }
`;

const COLLECT_EVENTS_QUERY = gql`
  query GetCollects($first: Int, $skip: Int, $orderBy: String, $orderDirection: String, $wherePositions: [String!]) {
    collects(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { token_in: $wherePositions }
    ) {
      id
      transaction {
        id
        timestamp
        blockNumber
      }
      token
      amount0
      amount1
      amountUSD
    }
  }
`;

export class UniswapEventsService {
  private subgraphUrl: string;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.subgraphUrl = UNISWAP_V3_SUBGRAPH_URL;
    this.apiKey = apiKey;
  }

  private getRequestHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private buildPositionsVariables(filter: EventsFilter) {
    return {
      first: filter.first || 1000,
      skip: filter.skip || 0,
      orderBy: filter.orderBy || 'id',
      orderDirection: filter.orderDirection || 'desc',
      whereOwner: filter.owner?.toLowerCase() || null
    };
  }

  private buildEventVariables(filter: EventsFilter, positions?: string[]) {
    return {
      first: filter.first || 1000,
      skip: filter.skip || 0,
      orderBy: filter.orderBy || 'timestamp',
      orderDirection: filter.orderDirection || 'desc',
      wherePositions: positions || filter.positions || (filter.position ? [filter.position] : null)
    };
  }

  async getPositions(filter: EventsFilter = {}): Promise<Position[]> {
    try {
      const variables = this.buildPositionsVariables(filter);

      const response = await request<{ positions: Position[] }>(
        this.subgraphUrl,
        POSITIONS_QUERY,
        variables,
        this.getRequestHeaders()
      );

      return response.positions;
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw new Error(`Failed to fetch positions: ${error}`);
    }
  }

  async getIncreaseLiquidityEvents(filter: EventsFilter = {}, positions?: string[]): Promise<IncreaseLiquidityEvent[]> {
    try {
      const variables = this.buildEventVariables(filter, positions);

      const response = await request<{ mints: any[] }>(
        this.subgraphUrl,
        INCREASE_LIQUIDITY_QUERY,
        variables,
        this.getRequestHeaders()
      );

      return response.mints.map(mint => ({
        id: mint.id,
        transaction: mint.transaction,
        position: { id: mint.token },
        amount0: mint.amount0,
        amount1: mint.amount1,
        liquidity: mint.amount
      }));
    } catch (error) {
      console.error('Error fetching increase liquidity events:', error);
      throw new Error(`Failed to fetch increase liquidity events: ${error}`);
    }
  }

  async getDecreaseLiquidityEvents(filter: EventsFilter = {}, positions?: string[]): Promise<DecreaseLiquidityEvent[]> {
    try {
      const variables = this.buildEventVariables(filter, positions);

      const response = await request<{ burns: any[] }>(
        this.subgraphUrl,
        DECREASE_LIQUIDITY_QUERY,
        variables,
        this.getRequestHeaders()
      );

      return response.burns.map(burn => ({
        id: burn.id,
        transaction: burn.transaction,
        position: { id: burn.token },
        amount0: burn.amount0,
        amount1: burn.amount1,
        liquidity: burn.amount
      }));
    } catch (error) {
      console.error('Error fetching decrease liquidity events:', error);
      throw new Error(`Failed to fetch decrease liquidity events: ${error}`);
    }
  }

  async getCollectEvents(filter: EventsFilter = {}, positions?: string[]): Promise<CollectEvent[]> {
    try {
      const variables = this.buildEventVariables(filter, positions);

      const response = await request<{ collects: any[] }>(
        this.subgraphUrl,
        COLLECT_EVENTS_QUERY,
        variables,
        this.getRequestHeaders()
      );

      return response.collects.map(collect => ({
        id: collect.id,
        transaction: collect.transaction,
        pool: { id: '', token0: { id: '', symbol: '', name: '', decimals: '' }, token1: { id: '', symbol: '', name: '', decimals: '' } },
        owner: '',
        amount0: collect.amount0,
        amount1: collect.amount1,
        amountUSD: collect.amountUSD,
        tickLower: '',
        tickUpper: '',
        logIndex: ''
      }));
    } catch (error) {
      console.error('Error fetching collect events:', error);
      throw new Error(`Failed to fetch collect events: ${error}`);
    }
  }

  async getAllEvents(filter: EventsFilter = {}): Promise<UniswapEventsResponse> {
    try {
      // 首先获取用户的所有位置
      const positions = await this.getPositions(filter);
      const positionIds = positions.map(p => p.id);

      if (positionIds.length === 0) {
        return {
          positions: [],
          increaseLiquidity: [],
          decreaseLiquidity: [],
          collects: []
        };
      }

      // 然后根据位置ID获取相关事件
      const [increaseLiquidity, decreaseLiquidity, collects] = await Promise.all([
        this.getIncreaseLiquidityEvents(filter, positionIds),
        this.getDecreaseLiquidityEvents(filter, positionIds),
        this.getCollectEvents(filter, positionIds)
      ]);

      return { positions, increaseLiquidity, decreaseLiquidity, collects };
    } catch (error) {
      console.error('Error fetching all events:', error);
      throw new Error(`Failed to fetch all events: ${error}`);
    }
  }

  async getPositionEvents(ownerAddress: string, filter: Omit<EventsFilter, 'owner'> = {}): Promise<UniswapEventsResponse> {
    return this.getAllEvents({
      ...filter,
      owner: ownerAddress
    });
  }
}

// Example usage:
// export const uniswapEventsService = new UniswapEventsService('YOUR_THE_GRAPH_API_KEY');