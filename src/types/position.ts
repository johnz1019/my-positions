export interface Token {
  chainId: number
  address: string
  symbol: string
  decimals: number
  name: string
  isNative?: boolean
}

export interface V3Position {
  tokenId: string
  tickLower: string
  tickUpper: string
  liquidity: string
  token0: Token
  token1: Token
  feeTier: string
  currentTick: string
  currentPrice: string
  tickSpacing: string
  token0UncollectedFees: string
  token1UncollectedFees: string
  amount0: string
  amount1: string
  poolId: string
  totalLiquidityUsd: string
  currentLiquidity: string
  apr: number
}

export interface PoolPosition {
  tokenId: string
  tickLower: string
  tickUpper: string
  liquidity: string
  token0: Token
  token1: Token
  feeTier: string
  currentTick: string
  currentPrice: string
  tickSpacing: string
  token0UncollectedFees: string
  token1UncollectedFees: string
  amount0: string
  amount1: string
  poolId: string
  totalLiquidityUsd: string
  currentLiquidity: string
  apr: number
  boostedApr?: number
  totalApr?: number
  unclaimedRewardsAmountUni?: string
}

export interface Hook {
  address: string
}

export interface V4Position {
  poolPosition: PoolPosition
  hooks: Hook[]
}

export interface Position {
  chainId: number
  protocolVersion: string
  v3Position?: V3Position
  v4Position?: V4Position
  status: PositionStatus
  timestamp: number
}

export interface PositionsResponse {
  positions: Position[]
  nextPageToken?: string
}

export type PositionStatus = 'POSITION_STATUS_IN_RANGE' | 'POSITION_STATUS_OUT_OF_RANGE' | 'POSITION_STATUS_CLOSED'