import { useState, useEffect } from 'react'
import type { Position } from '../types/position'
import PositionCard from './PositionCard'
import PortfolioSummary from './PortfolioSummary'
import { sqrtPriceX96ToPrice, isStablecoin } from '../utils/priceCalculations'
import './PositionsDisplay.css'

interface PositionsDisplayProps {
  addresses: string[]
}

interface AddressPositions {
  address: string
  positions: Position[]
  loading: boolean
  error: string | null
}

const PositionsDisplay: React.FC<PositionsDisplayProps> = ({ addresses }) => {
  const [addressPositions, setAddressPositions] = useState<AddressPositions[]>([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchAllPositions()
  }, [addresses])

  const fetchAllPositions = async () => {
    setIsInitialLoad(true)

    // Initialize state for all addresses
    const initialState = addresses.map(address => ({
      address,
      positions: [],
      loading: true,
      error: null
    }))
    setAddressPositions(initialState)

    // Fetch positions for all addresses in parallel
    const promises = addresses.map(async (address) => {
      try {
        const response = await fetch('/api/v2/pools.v1.PoolsService/ListPositions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: address,
            chainIds: [1, 130, 137, 8453, 42161, 10, 56, 43114, 480, 324, 1868, 7777777, 42220, 81457],
            protocolVersions: ['PROTOCOL_VERSION_V4', 'PROTOCOL_VERSION_V3', 'PROTOCOL_VERSION_V2'],
            positionStatuses: ['POSITION_STATUS_IN_RANGE', 'POSITION_STATUS_OUT_OF_RANGE'],
            pageSize: 100,
            pageToken: '',
            includeHidden: true
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        return {
          address,
          positions: data.positions || [],
          loading: false,
          error: null
        }
      } catch (err) {
        return {
          address,
          positions: [],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch positions'
        }
      }
    })

    const results = await Promise.all(promises)
    setAddressPositions(results)
    setIsInitialLoad(false)

    // Auto-expand addresses with positions
    const addressesWithPositions = results
      .filter(r => r.positions.length > 0)
      .map(r => r.address)
    setExpandedAddresses(new Set(addressesWithPositions))
  }

  const toggleAddress = (address: string) => {
    const newExpanded = new Set(expandedAddresses)
    if (newExpanded.has(address)) {
      newExpanded.delete(address)
    } else {
      newExpanded.add(address)
    }
    setExpandedAddresses(newExpanded)
  }

  // Calculate total value for a set of positions
  const calculateTotalValue = (positions: Position[]): number => {
    let totalValue = 0

    positions.forEach(position => {
      const isV4 = position.protocolVersion === 'PROTOCOL_VERSION_V4'
      const poolData = isV4 ? position.v4Position?.poolPosition : position.v3Position

      if (!poolData || !poolData.token0 || !poolData.token1) return

      const token0 = poolData.token0
      const token1 = poolData.token1

      const currentPriceFromSqrt = poolData.currentPrice
        ? sqrtPriceX96ToPrice(poolData.currentPrice, token0.decimals, token1.decimals)
        : null

      if (!currentPriceFromSqrt) return

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
        return // Can't calculate USD value without a stablecoin
      }

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

      totalValue += token0Value + token1Value + fee0Value + fee1Value
    })

    return totalValue
  }

  const formatUsdValue = (value: number): string => {
    if (value < 1) return '$0'
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // Calculate total positions count
  const totalPositions = addressPositions.reduce((sum, ap) => sum + ap.positions.length, 0)
  const allPositions = addressPositions.flatMap(ap => ap.positions)

  // Check if any addresses are still loading
  const anyLoading = addressPositions.some(ap => ap.loading)

  if (isInitialLoad && anyLoading) {
    return <div className="loading">Loading positions...</div>
  }

  return (
    <div className="positions-container">
      {/* Portfolio Summary */}
      {allPositions.length > 0 && (
        <PortfolioSummary positions={allPositions} />
      )}

      {/* Compact address list */}
      <div className="address-overview">
        {addressPositions.map(({ address, positions, loading, error }) => {
          const isExpanded = expandedAddresses.has(address)
          const addressTotalValue = calculateTotalValue(positions)

          return (
            <div key={address} className="address-section-compact">
              <div
                className={`address-header-compact ${positions.length > 0 ? 'clickable' : ''}`}
                onClick={() => positions.length > 0 && toggleAddress(address)}
              >
                <div className="address-info">
                  {positions.length > 0 && (
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                  )}
                  <span className="address-short">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                  <span className={`position-badge ${positions.length > 0 ? 'has-positions' : 'no-positions'}`}>
                    {loading ? '...' : positions.length}
                  </span>
                  {positions.length > 0 && addressTotalValue > 0 && (
                    <span className="address-value">{formatUsdValue(addressTotalValue)}</span>
                  )}
                </div>
                {error && <span className="error-badge">Error</span>}
              </div>

              {isExpanded && !loading && !error && positions.length > 0 && (
                <div className="positions-grid-compact">
                  {positions.map((position, index) => (
                    <PositionCard key={`${address}-${index}`} position={position} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Compact Summary Footer */}
      {totalPositions > 0 && (
        <div className="summary-footer">
          <span className="summary-stat">
            <strong>{totalPositions}</strong> total positions
          </span>
          <span className="summary-divider">•</span>
          <span className="summary-stat">
            <strong>{addresses.length}</strong> addresses
          </span>
          <span className="summary-divider">•</span>
          <span className="summary-stat">
            <strong>{addressPositions.filter(ap => ap.positions.length > 0).length}</strong> with positions
          </span>
        </div>
      )}
    </div>
  )
}

export default PositionsDisplay