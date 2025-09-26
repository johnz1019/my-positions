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

export interface PositionSnapshot {
  id: string;
  owner: string;
  position: {
    id: string;
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
  };
  blockNumber: string;
  timestamp: string;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  transaction: {
    id: string;
  };
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
}

export interface PositionsFilter {
  owner?: string;
  pool?: string;
  first?: number;
  skip?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
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

const POSITION_SNAPSHOTS_QUERY = gql`
  query GetPositionSnapshots($first: Int, $skip: Int, $orderBy: String, $orderDirection: String, $whereOwner: String, $wherePositions: [String!]) {
    positionSnapshots(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { owner: $whereOwner, position_in: $wherePositions }
    ) {
      id
      owner
      position {
        id
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
      }
      blockNumber
      timestamp
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      collectedFeesToken0
      collectedFeesToken1
      transaction {
        id
      }
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
    }
  }
`;

const MINTS_QUERY = gql`
  query GetMints($first: Int, $skip: Int, $wherePositions: [String!]) {
    mints(
      first: $first
      skip: $skip
      where: { token_in: $wherePositions }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      token
      transaction {
        id
        timestamp
      }
    }
  }
`;

const BURNS_QUERY = gql`
  query GetBurns($first: Int, $skip: Int, $wherePositions: [String!]) {
    burns(
      first: $first
      skip: $skip
      where: { token_in: $wherePositions }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      token
      transaction {
        id
        timestamp
      }
    }
  }
`;

export class UniswapPositionsService {
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

  private buildPositionsVariables(filter: PositionsFilter) {
    return {
      first: filter.first || 1000,
      skip: filter.skip || 0,
      orderBy: filter.orderBy || 'id',
      orderDirection: filter.orderDirection || 'desc',
      whereOwner: filter.owner?.toLowerCase() || null
    };
  }

  private buildSnapshotsVariables(filter: PositionsFilter, positions?: string[]) {
    return {
      first: filter.first || 1000,
      skip: filter.skip || 0,
      orderBy: filter.orderBy || 'timestamp',
      orderDirection: filter.orderDirection || 'desc',
      whereOwner: filter.owner?.toLowerCase() || null,
      wherePositions: positions || null
    };
  }

  async getPositions(filter: PositionsFilter = {}): Promise<Position[]> {
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

  async getPositionSnapshots(filter: PositionsFilter = {}, positions?: string[]): Promise<PositionSnapshot[]> {
    try {
      const variables = this.buildSnapshotsVariables(filter, positions);

      const response = await request<{ positionSnapshots: PositionSnapshot[] }>(
        this.subgraphUrl,
        POSITION_SNAPSHOTS_QUERY,
        variables,
        this.getRequestHeaders()
      );

      return response.positionSnapshots;
    } catch (error) {
      console.error('Error fetching position snapshots:', error);
      throw new Error(`Failed to fetch position snapshots: ${error}`);
    }
  }

  async getMints(positions: string[]): Promise<any[]> {
    try {
      const variables = {
        first: 1000,
        skip: 0,
        wherePositions: positions
      };

      const response = await request<{ mints: any[] }>(
        this.subgraphUrl,
        MINTS_QUERY,
        variables,
        this.getRequestHeaders()
      );

      return response.mints;
    } catch (error) {
      console.error('Error fetching mints:', error);
      return [];
    }
  }

  async getBurns(positions: string[]): Promise<any[]> {
    try {
      const variables = {
        first: 1000,
        skip: 0,
        wherePositions: positions
      };

      const response = await request<{ burns: any[] }>(
        this.subgraphUrl,
        BURNS_QUERY,
        variables,
        this.getRequestHeaders()
      );

      return response.burns;
    } catch (error) {
      console.error('Error fetching burns:', error);
      return [];
    }
  }

  async getUserPositionsWithHistory(ownerAddress: string, filter: Omit<PositionsFilter, 'owner'> = {}) {
    try {
      // 获取用户的所有位置
      const positions = await this.getPositions({
        ...filter,
        owner: ownerAddress
      });

      if (positions.length === 0) {
        return {
          positions: [],
          snapshots: []
        };
      }

      // 获取位置的历史快照
      const positionIds = positions.map(p => p.id);
      const snapshots = await this.getPositionSnapshots({
        ...filter,
        owner: ownerAddress
      }, positionIds);

      return {
        positions,
        snapshots
      };
    } catch (error) {
      console.error('Error fetching user positions with history:', error);
      throw new Error(`Failed to fetch user positions with history: ${error}`);
    }
  }

  // 计算位置的净收益/损失
  calculatePositionPnL(position: Position) {
    const deposited0 = parseFloat(position.depositedToken0);
    const deposited1 = parseFloat(position.depositedToken1);
    const withdrawn0 = parseFloat(position.withdrawnToken0);
    const withdrawn1 = parseFloat(position.withdrawnToken1);
    const collectedFees0 = parseFloat(position.collectedFeesToken0);
    const collectedFees1 = parseFloat(position.collectedFeesToken1);

    return {
      netToken0: withdrawn0 + collectedFees0 - deposited0,
      netToken1: withdrawn1 + collectedFees1 - deposited1,
      totalFeesToken0: collectedFees0,
      totalFeesToken1: collectedFees1,
      totalDepositedToken0: deposited0,
      totalDepositedToken1: deposited1,
      totalWithdrawnToken0: withdrawn0,
      totalWithdrawnToken1: withdrawn1
    };
  }

  // 分析用户的流动性活动
  async analyzeUserActivity(ownerAddress: string) {
    const data = await this.getUserPositionsWithHistory(ownerAddress);

    const analysis = {
      totalPositions: data.positions.length,
      activePositions: data.positions.filter(p => parseFloat(p.liquidity) > 0).length,
      totalSnapshots: data.snapshots.length,
      positions: data.positions.map(position => ({
        ...position,
        pnl: this.calculatePositionPnL(position),
        pool: {
          ...position.pool,
          pair: `${position.pool.token0.symbol}/${position.pool.token1.symbol}`
        }
      })),
      snapshots: data.snapshots
    };

    return analysis;
  }
}

export const uniswapPositionsService = new UniswapPositionsService();