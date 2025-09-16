import { useState, useEffect } from 'react'
import type { Position } from '../types/position'
import { calculatePriceRange, formatPrice, sqrtPriceX96ToPrice, getPriceDisplay, isStablecoin } from '../utils/priceCalculations'
import { getTokenPrices, getTokenPriceBySymbol } from '../utils/tokenPrices'
import './PositionCard.css'

interface PositionCardProps {
  position: Position
}

const PositionCard: React.FC<PositionCardProps> = ({ position }) => {
  // 兼容 v3 和 v4 positions
  const isV4 = position.protocolVersion === 'PROTOCOL_VERSION_V4'
  const poolData = isV4 ? position.v4Position?.poolPosition : position.v3Position

  const [tokenPrices, setTokenPrices] = useState<{ [address: string]: number }>({})
  const [uniPrice, setUniPrice] = useState<number>(0)

  // Debug positions
  console.log(`${isV4 ? 'V4' : 'V3'} Position Debug:`, {
    protocolVersion: position.protocolVersion,
    isV4,
    status: position.status,
    chainId: position.chainId,
    v4Data: position.v4Position,
    v3Data: position.v3Position,
    poolData: poolData,
    hasPoolData: !!poolData,
    hasTokens: !!(poolData?.token0 && poolData?.token1)
  })

  // 从 position 获取 token 信息
  const token0 = poolData?.token0
  const token1 = poolData?.token1

  // Fetch token prices including UNI
  useEffect(() => {
    const fetchPrices = async () => {
      const addresses = []

      if (token0 && !isStablecoin(token0.symbol)) {
        addresses.push(token0.address.toLowerCase())
      }
      if (token1 && !isStablecoin(token1.symbol)) {
        addresses.push(token1.address.toLowerCase())
      }

      if (addresses.length > 0) {
        const prices = await getTokenPrices(addresses)
        const priceMap: { [address: string]: number } = {}
        Object.entries(prices).forEach(([addr, data]) => {
          priceMap[addr.toLowerCase()] = data.usd
        })
        setTokenPrices(priceMap)
      }

      // Fetch UNI price if there are UNI rewards
      if (isV4 && position.v4Position?.poolPosition?.unclaimedRewardsAmountUni &&
          parseFloat(position.v4Position.poolPosition.unclaimedRewardsAmountUni) > 0) {
        const uniPriceResult = await getTokenPriceBySymbol('UNI')
        if (uniPriceResult) {
          setUniPrice(uniPriceResult)
        }
      }
    }

    fetchPrices()
  }, [token0, token1, isV4, position])

  // 计算价格
  const priceInfo = poolData && token0 && token1 ? calculatePriceRange(
    poolData.tickLower,
    poolData.tickUpper,
    poolData.currentTick,
    token0,
    token1
  ) : null

  // 如果有 currentPrice (sqrtPriceX96)，使用它计算更精确的价格
  const currentPriceFromSqrt = poolData?.currentPrice && token0 && token1
    ? sqrtPriceX96ToPrice(poolData.currentPrice, token0.decimals, token1.decimals)
    : null


  // 获取正确的价格显示方向（以稳定币为基础）
  const getPriceDisplayInfo = (price: number | null) => {
    if (!price || !token0 || !token1) return null
    return getPriceDisplay(price, token0, token1)
  }

  const currentPriceDisplay = getPriceDisplayInfo(currentPriceFromSqrt || priceInfo?.currentPrice || null)
  const minPriceDisplay = priceInfo && token0 && token1 ? getPriceDisplay(priceInfo.priceLower, token0, token1) : null
  const maxPriceDisplay = priceInfo && token0 && token1 ? getPriceDisplay(priceInfo.priceUpper, token0, token1) : null

  const formatTokenAmount = (amount: string | undefined, decimals: number | undefined) => {
    if (!amount) return '0'
    // Use the provided decimals, or fallback to 18 if not provided
    const actualDecimals = decimals ?? 18

    // Debug log to check if decimals are being passed correctly
    if (decimals === undefined) {
      console.warn('formatTokenAmount called with undefined decimals, using default 18')
    }

    const divisor = Math.pow(10, actualDecimals)
    const num = parseFloat(amount) / divisor
    if (num < 0.0001) return '<0.0001'
    if (num < 1) return num.toFixed(4)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  const getStatusColor = (status: string | undefined) => {
    if (status === 'POSITION_STATUS_IN_RANGE') return 'in-range'
    if (status === 'POSITION_STATUS_OUT_OF_RANGE') return 'out-of-range'
    return 'unknown'
  }

  const getChainName = (chainId: number) => {
    const chains: { [key: number]: string } = {
      1: 'Ethereum',
      130: 'Unichain',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base',
      56: 'BSC',
      43114: 'Avalanche',
      324: 'zkSync Era',
      42220: 'Celo',
      81457: 'Blast',
    }
    return chains[chainId] || `Chain ${chainId}`
  }


  // 计算当前价格在范围内的位置百分比（基于美元价格）
  const calculatePricePosition = (): number => {
    if (!currentPriceDisplay || !minPriceDisplay || !maxPriceDisplay) {
      // Fallback to tick-based calculation
      if (!poolData) return 50
      const currentTick = parseInt(poolData.currentTick)
      const tickLower = parseInt(poolData.tickLower)
      const tickUpper = parseInt(poolData.tickUpper)

      if (currentTick <= tickLower) return 0
      if (currentTick >= tickUpper) return 100
      const range = tickUpper - tickLower
      const position = currentTick - tickLower
      return (position / range) * 100
    }

    // Calculate based on USD prices
    const currentPrice = currentPriceDisplay.displayPrice
    const minPrice = Math.min(minPriceDisplay.displayPrice, maxPriceDisplay.displayPrice)
    const maxPrice = Math.max(minPriceDisplay.displayPrice, maxPriceDisplay.displayPrice)

    if (currentPrice <= minPrice) return 0
    if (currentPrice >= maxPrice) return 100

    const range = maxPrice - minPrice
    const position = currentPrice - minPrice
    return (position / range) * 100
  }

  // 计算 token 的美元价值
  const calculateTokenUsdValue = (amount: string | undefined, decimals: number | undefined, priceInUsd: number): number => {
    if (!amount || !decimals) return 0
    const actualDecimals = decimals ?? 18
    const divisor = Math.pow(10, actualDecimals)
    const tokenAmount = parseFloat(amount) / divisor
    return tokenAmount * priceInUsd
  }

  // 获取 token 的美元价格（基于当前价格和稳定币）
  const getTokenPriceInUsd = (): { token0Price: number; token1Price: number } => {
    if (!token0 || !token1 || !currentPriceFromSqrt) {
      return { token0Price: 0, token1Price: 0 }
    }

    const token0IsStable = isStablecoin(token0.symbol)
    const token1IsStable = isStablecoin(token1.symbol)

    // Try to get prices from CoinGecko first
    const token0ApiPrice = tokenPrices[token0.address.toLowerCase()]
    const token1ApiPrice = tokenPrices[token1.address.toLowerCase()]

    if (token0ApiPrice && token1ApiPrice) {
      // Both tokens have API prices
      return {
        token0Price: token0ApiPrice,
        token1Price: token1ApiPrice
      }
    }

    // 如果 token1 是稳定币，price 是 1 token0 = price token1 (USD)
    if (token1IsStable) {
      return {
        token0Price: token0ApiPrice || currentPriceFromSqrt,
        token1Price: 1
      }
    }

    // 如果 token0 是稳定币，price 是 1 token0 = price token1，所以 1 token1 = 1/price token0 (USD)
    if (token0IsStable) {
      return {
        token0Price: 1,
        token1Price: token1ApiPrice || (1 / currentPriceFromSqrt)
      }
    }

    // If one token has API price, calculate the other
    if (token0ApiPrice && !token1ApiPrice) {
      return {
        token0Price: token0ApiPrice,
        token1Price: token0ApiPrice / currentPriceFromSqrt
      }
    }

    if (!token0ApiPrice && token1ApiPrice) {
      return {
        token0Price: token1ApiPrice * currentPriceFromSqrt,
        token1Price: token1ApiPrice
      }
    }

    // 如果都不是稳定币且没有API价格，无法计算准确的美元价值
    return { token0Price: 0, token1Price: 0 }
  }

  const { token0Price, token1Price } = getTokenPriceInUsd()

  // 计算各项美元价值
  const token0UsdValue = calculateTokenUsdValue(poolData?.amount0, token0?.decimals, token0Price)
  const token1UsdValue = calculateTokenUsdValue(poolData?.amount1, token1?.decimals, token1Price)
  const fee0UsdValue = calculateTokenUsdValue(poolData?.token0UncollectedFees, token0?.decimals, token0Price)
  const fee1UsdValue = calculateTokenUsdValue(poolData?.token1UncollectedFees, token1?.decimals, token1Price)

  // Calculate UNI rewards value
  const uniRewardsUsdValue = isV4 && position.v4Position?.poolPosition?.unclaimedRewardsAmountUni && uniPrice > 0
    ? calculateTokenUsdValue(position.v4Position.poolPosition.unclaimedRewardsAmountUni, 18, uniPrice)
    : 0

  const totalTokensUsdValue = token0UsdValue + token1UsdValue
  const totalFeesUsdValue = fee0UsdValue + fee1UsdValue + uniRewardsUsdValue
  const totalPositionValue = totalTokensUsdValue + totalFeesUsdValue

  // If no pool data at all, show minimal card
  if (!poolData) {
    return (
      <div className="position-card">
        <div className="position-header">
          <div className="header-left">
            <div className="token-pair">
              Loading position data...
            </div>
            <div className="chain-badge">{getChainName(position.chainId)}</div>
          </div>
          <div className="header-right">
            <span className="protocol-version">{isV4 ? 'V4' : 'V3'}</span>
            <div className={`position-status ${getStatusColor(position.status)}`}>
              {position.status === 'POSITION_STATUS_IN_RANGE' ? 'In Range' : 'Out'}
            </div>
          </div>
        </div>
        <div className="position-info">
          <div className="no-data-message">
            Pool data not available for this {isV4 ? 'V4' : 'V3'} position
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="position-card">
      <div className="position-header">
        <div className="header-left">
          <div className="token-pair">
            {token0?.symbol || 'Unknown'} / {token1?.symbol || 'Unknown'}
            <span className="fee-tier">{poolData.feeTier ? `${(parseInt(poolData.feeTier) / 10000).toFixed(2)}%` : ''}</span>
            {poolData?.apr && (
              <span className="apr-badge">
                APR {isV4 && 'totalApr' in poolData && typeof poolData.totalApr === 'number'
                  ? `${poolData.totalApr.toFixed(1)}%`
                  : `${poolData.apr.toFixed(1)}%`
                }
              </span>
            )}
          </div>
          <div className="chain-badge">{getChainName(position.chainId)}</div>
        </div>
        <div className="header-right">
          <span className="protocol-version">{isV4 ? 'V4' : 'V3'}</span>
          <div className={`position-status ${getStatusColor(position.status)}`}>
            {position.status === 'POSITION_STATUS_IN_RANGE' ? 'In Range' : 'Out'}
          </div>
        </div>
      </div>

      <div className="position-info">
        {/* Main Value Display */}
        {(token0Price > 0 || token1Price > 0) ? (
          <div className="value-summary">
            <div className="value-item primary">
              <span className="value-label">Position</span>
              <span className="value-amount">${totalTokensUsdValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
            <div className="value-item">
              <span className="value-label">Fees</span>
              <span className="value-amount">${totalFeesUsdValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
            <div className="value-item total">
              <span className="value-label">Total</span>
              <span className="value-amount">${totalPositionValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        ) : poolData?.apr ? (
          <div className="value-summary">
            <div className="value-item">
              <span className="value-label">APR</span>
              <span className="apr-standalone">
                {isV4 && 'totalApr' in poolData && typeof poolData.totalApr === 'number'
                  ? `${poolData.totalApr.toFixed(1)}%`
                  : `${poolData.apr.toFixed(1)}%`
                }
              </span>
            </div>
          </div>
        ) : null}

        {poolData && (
          <>
            {/* Combined Price, Range and Progress */}
            <div className="price-range-section">
              <div className="price-info-compact">
                {currentPriceDisplay && (
                  <div className="current-price-inline">
                    <span className="price-label">Price:</span>
                    <span className="price-value">1 {currentPriceDisplay.baseSymbol} = {formatPrice(currentPriceDisplay.displayPrice, isStablecoin(currentPriceDisplay.quoteSymbol))} {currentPriceDisplay.quoteSymbol}</span>
                  </div>
                )}
                {minPriceDisplay && maxPriceDisplay && (
                  <div className="range-inline">
                    <span className="range-label">Range:</span>
                    <span className="range-values">
                      {/* Always show range from lower to higher price */}
                      ${Math.min(minPriceDisplay.displayPrice, maxPriceDisplay.displayPrice).toFixed(2)} - ${Math.max(minPriceDisplay.displayPrice, maxPriceDisplay.displayPrice).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <div className="tick-progress-inline">
                <div className="tick-progress-bar-small">
                  <div className="tick-progress-track">
                    <div
                      className="tick-progress-indicator"
                      style={{
                        width: `${calculatePricePosition()}%`
                      }}
                    />
                  </div>
                </div>
                <span className="tick-percent">
                  {calculatePricePosition().toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Token Amounts - Single Line Display */}
            <div className="token-details-inline">
              <div className="token-left">
                <span className="token-symbol">{token0?.symbol || 'Token0'}</span>
                <span className="token-amount">{formatTokenAmount(poolData.amount0, token0?.decimals)}</span>
                {token0Price > 0 && (
                  <span className="token-usd">${token0UsdValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                )}
              </div>
              <div className="token-divider">|</div>
              <div className="token-right">
                <span className="token-symbol">{token1?.symbol || 'Token1'}</span>
                <span className="token-amount">{formatTokenAmount(poolData.amount1, token1?.decimals)}</span>
                {token1Price > 0 && (
                  <span className="token-usd">${token1UsdValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                )}
              </div>
            </div>

            {/* Uncollected Fees and Rewards */}
            {(parseFloat(poolData.token0UncollectedFees) > 0 ||
              parseFloat(poolData.token1UncollectedFees) > 0 ||
              (isV4 && position.v4Position?.poolPosition?.unclaimedRewardsAmountUni && parseFloat(position.v4Position.poolPosition.unclaimedRewardsAmountUni) > 0)) && (
              <div className="fees-row">
                <span className="fees-label">Uncollected:</span>
                <div className="fees-content">
                  {(parseFloat(poolData.token0UncollectedFees) > 0 || parseFloat(poolData.token1UncollectedFees) > 0) && (
                    <span className="fees-amount">
                      {formatTokenAmount(poolData.token0UncollectedFees, token0?.decimals)} {token0?.symbol} + {formatTokenAmount(poolData.token1UncollectedFees, token1?.decimals)} {token1?.symbol}
                    </span>
                  )}
                  {isV4 && position.v4Position?.poolPosition?.unclaimedRewardsAmountUni && parseFloat(position.v4Position.poolPosition.unclaimedRewardsAmountUni) > 0 && (
                    <>
                      {(parseFloat(poolData.token0UncollectedFees) > 0 || parseFloat(poolData.token1UncollectedFees) > 0) &&
                        <span className="fees-separator">•</span>
                      }
                      <span className="uni-reward-inline">
                        {formatTokenAmount(position.v4Position.poolPosition.unclaimedRewardsAmountUni, 18)} UNI
                        {uniPrice > 0 && (
                          <span className="token-usd"> (${uniRewardsUsdValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})</span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default PositionCard