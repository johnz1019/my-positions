import { useMemo } from 'react'
import type { Position } from '../types/position'
import { sqrtPriceX96ToPrice, isStablecoin } from '../utils/priceCalculations'
import './PortfolioSummary.css'

interface PortfolioSummaryProps {
  positions: Position[]
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ positions }) => {
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

      if (token1IsStable) {
        token0Price = currentPriceFromSqrt
        token1Price = 1
      } else if (token0IsStable) {
        token0Price = 1
        token1Price = 1 / currentPriceFromSqrt
      } else {
        // Can't calculate USD value without a stablecoin
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

      if (token0Value > 0 || token1Value > 0 || fee0Value > 0 || fee1Value > 0) {
        totalPositionValue += token0Value + token1Value
        totalFeesValue += fee0Value + fee1Value
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
  }, [positions])

  const formatUsdValue = (value: number): string => {
    if (value < 1) return `$${value.toFixed(2)}`
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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