import { useMemo, useEffect, useState } from 'react'
import type { Position } from '../types/position'
import { sqrtPriceX96ToPrice, isStablecoin } from '../utils/priceCalculations'
import { getTokenPrices } from '../utils/tokenPrices'
import './PortfolioSummary.css'

interface PortfolioSummaryProps {
  positions: Position[]
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ positions }) => {
  const [tokenPrices, setTokenPrices] = useState<{ [address: string]: number }>({})
  const [uniPrice, setUniPrice] = useState<number>(0)

  // Fetch token prices for all non-stablecoin tokens including UNI
  useEffect(() => {
    const fetchPrices = async () => {
      const tokenAddresses = new Set<string>()
      let needUniPrice = false

      positions.forEach(position => {
        const isV4 = position.protocolVersion === 'PROTOCOL_VERSION_V4'
        const poolData = isV4 ? position.v4Position?.poolPosition : position.v3Position

        if (poolData?.token0 && !isStablecoin(poolData.token0.symbol)) {
          tokenAddresses.add(poolData.token0.address.toLowerCase())
        }
        if (poolData?.token1 && !isStablecoin(poolData.token1.symbol)) {
          tokenAddresses.add(poolData.token1.address.toLowerCase())
        }

        // Check if any V4 position has UNI rewards
        if (isV4 && position.v4Position?.poolPosition?.unclaimedRewardsAmountUni &&
            parseFloat(position.v4Position.poolPosition.unclaimedRewardsAmountUni) > 0) {
          needUniPrice = true
        }
      })

      if (tokenAddresses.size > 0) {
        const prices = await getTokenPrices(Array.from(tokenAddresses))
        const priceMap: { [address: string]: number } = {}
        Object.entries(prices).forEach(([addr, data]) => {
          priceMap[addr.toLowerCase()] = data.usd
        })
        setTokenPrices(priceMap)
      }

      // Fetch UNI price if needed
      if (needUniPrice) {
        const { getTokenPriceBySymbol } = await import('../utils/tokenPrices')
        const uniPriceResult = await getTokenPriceBySymbol('UNI')
        if (uniPriceResult) {
          setUniPrice(uniPriceResult)
        }
      }
    }

    fetchPrices()
  }, [positions])

  const totals = useMemo(() => {
    let totalPositionValue = 0
    let totalFeesValue = 0
    let positionsWithValue = 0

    positions.forEach(position => {
      const isV4 = position.protocolVersion === 'PROTOCOL_VERSION_V4'
      const poolData = isV4 ? position.v4Position?.poolPosition : position.v3Position

      if (!poolData || !poolData.token0 || !poolData.token1) return

      const token0 = poolData.token0
      const token1 = poolData.token1

      // Calculate current price
      const currentPriceFromSqrt = poolData.currentPrice
        ? sqrtPriceX96ToPrice(poolData.currentPrice, token0.decimals, token1.decimals)
        : null

      if (!currentPriceFromSqrt) return

      // Determine USD prices
      const token0IsStable = isStablecoin(token0.symbol)
      const token1IsStable = isStablecoin(token1.symbol)

      let token0Price = 0
      let token1Price = 0

      // Try to get prices from CoinGecko first
      const token0ApiPrice = tokenPrices[token0.address.toLowerCase()]
      const token1ApiPrice = tokenPrices[token1.address.toLowerCase()]

      if (token0ApiPrice && token1ApiPrice) {
        // Both tokens have API prices
        token0Price = token0ApiPrice
        token1Price = token1ApiPrice
      } else if (token1IsStable) {
        // Token1 is stablecoin, calculate token0 price
        token0Price = currentPriceFromSqrt
        token1Price = 1
      } else if (token0IsStable) {
        // Token0 is stablecoin, calculate token1 price
        token0Price = 1
        token1Price = 1 / currentPriceFromSqrt
      } else if (token0ApiPrice && !token1ApiPrice) {
        // Only token0 has API price, calculate token1 price
        token0Price = token0ApiPrice
        token1Price = token0ApiPrice / currentPriceFromSqrt
      } else if (!token0ApiPrice && token1ApiPrice) {
        // Only token1 has API price, calculate token0 price
        token1Price = token1ApiPrice
        token0Price = token1ApiPrice * currentPriceFromSqrt
      } else {
        // No price data available
        return
      }

      // Calculate token amounts in USD
      const formatTokenValue = (amount: string | undefined, decimals: number, priceInUsd: number): number => {
        if (!amount) return 0
        const divisor = Math.pow(10, decimals)
        const tokenAmount = parseFloat(amount) / divisor
        return tokenAmount * priceInUsd
      }

      const token0Value = formatTokenValue(poolData.amount0, token0.decimals, token0Price)
      const token1Value = formatTokenValue(poolData.amount1, token1.decimals, token1Price)
      const fee0Value = formatTokenValue(poolData.token0UncollectedFees, token0.decimals, token0Price)
      const fee1Value = formatTokenValue(poolData.token1UncollectedFees, token1.decimals, token1Price)

      // Calculate UNI rewards value for V4 positions
      let uniRewardsValue = 0
      if (isV4 && position.v4Position?.poolPosition?.unclaimedRewardsAmountUni && uniPrice > 0) {
        const uniAmount = parseFloat(position.v4Position.poolPosition.unclaimedRewardsAmountUni)
        if (uniAmount > 0) {
          uniRewardsValue = formatTokenValue(
            position.v4Position.poolPosition.unclaimedRewardsAmountUni,
            18, // UNI has 18 decimals
            uniPrice
          )
        }
      }

      if (token0Value > 0 || token1Value > 0 || fee0Value > 0 || fee1Value > 0 || uniRewardsValue > 0) {
        totalPositionValue += token0Value + token1Value
        totalFeesValue += fee0Value + fee1Value + uniRewardsValue
        positionsWithValue++
      }
    })

    return {
      totalPositionValue,
      totalFeesValue,
      totalValue: totalPositionValue + totalFeesValue,
      positionsWithValue,
      totalPositions: positions.length
    }
  }, [positions, tokenPrices, uniPrice])

  const formatUsdValue = (value: number): string => {
    if (value < 1) return `$${value.toFixed(2)}`
    // 显示完整数字，使用逗号分隔千位
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="portfolio-summary-compact">
      <div className="summary-row">
        <div className="summary-item">
          <span className="summary-label">Portfolio</span>
          <span className="summary-value total">{formatUsdValue(totals.totalValue)}</span>
        </div>
        <div className="summary-divider">|</div>
        <div className="summary-item">
          <span className="summary-label">Positions</span>
          <span className="summary-value">{formatUsdValue(totals.totalPositionValue)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Fees</span>
          <span className="summary-value fees">{formatUsdValue(totals.totalFeesValue)}</span>
        </div>
        <div className="summary-divider">|</div>
        <div className="summary-item">
          <span className="summary-label positions-count">
            {totals.positionsWithValue}/{totals.totalPositions} valued
          </span>
        </div>
      </div>
    </div>
  )
}

export default PortfolioSummary