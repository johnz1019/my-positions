import { useState, useEffect } from 'react'
import './PnLPage.css'

interface Operation {
  timestamp: number
  date: string
  type: 'SWAP' | 'POSITION_OPEN' | 'POSITION_CLOSE'
  description: string
  stableChange: number
  nativeChange: number
  cumulativeStable: number
  cumulativeNative: number
  nativePrice: number
  totalUSDValue: number
  cumulativeFeesStable: number
  cumulativeFeesNative: number
  cumulativeFeesUSD: number
  details: any
}

interface PnlResponse {
  swapPnL: {
    netStable: number
    netNative: number
    avgPrice: number
    totalGasCost: number
    transactionCount: number
  }
  positionPnL: {
    netToken0: number
    netToken1: number
    avgPrice: number
    totalFeesToken0: number
    totalFeesToken1: number
    closedPositions: number
    activePositions?: {
      count: number
      totalUnrealizedPnL: {
        token0: number
        token1: number
      }
      totalCurrentValue: {
        token0: number
        token1: number
      }
      inRangeCount: number
      outOfRangeCount: number
    }
  }
  combined: {
    totalNetStable: number
    totalNetNative: number
    combinedAvgPrice: number
    totalProfit: number
    totalGasCost: number
  }
  timeline: Operation[]
  chainConfig: {
    name: string
    chainId: number
    nativeToken: { symbol: string; decimals: number }
    stableToken: { symbol: string; decimals: number }
  }
}

interface PnLPageProps {
  address?: string
  chain?: string
}

function PnLPage({ address: initialAddress = '0x6D530C88f583478fdc2E553F872bbe6dDd89c7Ee', chain: initialChain = 'bsc' }: PnLPageProps) {
  const [pnlData, setPnlData] = useState<PnlResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedChain, setSelectedChain] = useState(initialChain)
  const [address, setAddress] = useState(initialAddress)

  useEffect(() => {
    const fetchPnLData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`https://uni-lp.sking789.me/api/pnl?address=${address}&chain=${selectedChain}`)
        // const response = await fetch(`http://localhost:3002/api/pnl?address=${address}&chain=${selectedChain}`)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: PnlResponse = await response.json()
        console.log('API response:', result)
        setPnlData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch PnL data')
      } finally {
        setLoading(false)
      }
    }

    fetchPnLData()
  }, [address, selectedChain])

  if (loading) {
    return (
      <div className="pnl-page">
        <div className="loading">Loading PnL data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="pnl-page">
        <div className="error">Error: {error}</div>
      </div>
    )
  }

  if (!pnlData || !pnlData.timeline || pnlData.timeline.length === 0) {
    return (
      <div className="pnl-page">
        <div className="pnl-header">
          <h1>{pnlData?.chainConfig?.name || selectedChain.toUpperCase()} Timeline: PnL Evolution Over Time</h1>
          <div className="pnl-controls">
            <div className="control-group">
              <label htmlFor="address-input-empty">Address:</label>
              <input
                id="address-input-empty"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="address-input"
              />
            </div>
            <div className="control-group">
              <label htmlFor="chain-select-empty">Chain:</label>
              <select
                id="chain-select-empty"
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="chain-select"
              >
                <option value="bsc">BSC</option>
                <option value="base">Base</option>
              </select>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="refresh-btn"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="no-data">No PnL data available for this address.</div>
      </div>
    )
  }

  const { timeline, chainConfig } = pnlData
  const stableSymbol = chainConfig?.stableToken?.symbol || 'USDT'
  const nativeSymbol = chainConfig?.nativeToken?.symbol || 'BNB'

  return (
    <div className="pnl-page">
      <div className="pnl-header">
        <h1>{chainConfig?.name || selectedChain.toUpperCase()} Timeline: PnL Evolution Over Time</h1>
        <div className="pnl-controls">
          <div className="control-group">
            <label htmlFor="address-input">Address:</label>
            <input
              id="address-input"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="address-input"
            />
          </div>
          <div className="control-group">
            <label htmlFor="chain-select">Chain:</label>
            <select
              id="chain-select"
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="chain-select"
            >
              <option value="bsc">BSC</option>
              <option value="base">Base</option>
            </select>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="refresh-btn"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>


      <div className="pnl-table-container">
        <table className="pnl-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th>{stableSymbol}</th>
              <th>{nativeSymbol}</th>
              <th>Price</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            {timeline.slice().reverse().map((operation, index) => (
              <tr key={index} className={getRowClassName(operation.type)}>
                <td className="date">{operation.date.split(' ')[0]}<br/><span className="time">{operation.date.split(' ')[1]}</span></td>
                <td className="type">{operation.type.replace('POSITION_', '').replace('_', ' ')}</td>
                <td className="description" title={operation.description}>
                  {operation.description.length > 35 ?
                    operation.description.substring(0, 32) + '...' :
                    operation.description
                  }
                </td>
                <td className="combined-amount">
                  <div className={`change ${operation.stableChange >= 0 ? 'positive' : 'negative'}`}>
                    {operation.stableChange >= 0 ? '+' : ''}{Math.abs(operation.stableChange) >= 1000 ?
                      (operation.stableChange / 1000).toFixed(1) + 'k' :
                      operation.stableChange.toFixed(0)
                    }
                  </div>
                  <div className={`cumulative ${operation.cumulativeStable >= 0 ? 'positive' : 'negative'}`}>
                    ({Math.abs(operation.cumulativeStable) >= 1000 ?
                      (operation.cumulativeStable / 1000).toFixed(1) + 'k' :
                      operation.cumulativeStable.toFixed(0)
                    })
                  </div>
                </td>
                <td className="combined-amount">
                  <div className={`change ${operation.nativeChange >= 0 ? 'positive' : 'negative'}`}>
                    {operation.nativeChange >= 0 ? '+' : ''}{operation.nativeChange.toFixed(1)}
                  </div>
                  <div className={`cumulative ${operation.cumulativeNative >= 0 ? 'positive' : 'negative'}`}>
                    ({operation.cumulativeNative.toFixed(1)})
                  </div>
                </td>
                <td className="price">${operation.nativePrice.toFixed(0)}</td>
                <td className="pnl">
                  {operation.type === 'POSITION_CLOSE' ?
                    (Math.abs(operation.totalUSDValue) >= 1000 ?
                      '$' + (operation.totalUSDValue / 1000).toFixed(1) + 'k' :
                      '$' + operation.totalUSDValue.toFixed(0)
                    ) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="mobile-cards">
        {timeline.slice().reverse().map((operation, index) => (
          <div key={index} className="mobile-card">
            <div className="mobile-card-header">
              <span className="mobile-card-number">#{timeline.length - index}</span>
              <span className="mobile-card-date">{operation.date}</span>
            </div>

            <div className={`mobile-card-type ${operation.type.toLowerCase().replace('_', '-')}`}>
              {operation.type.replace('_', ' ')}
            </div>

            <div className="mobile-card-description">
              {operation.description}
            </div>

            <div className="mobile-card-amounts">
              <div className="mobile-amount-item">
                <span className="mobile-amount-label">{stableSymbol} Δ:</span>
                <span className={`mobile-amount-value ${operation.stableChange >= 0 ? 'positive' : 'negative'}`}>
                  {operation.stableChange >= 0 ? '+' : ''}{Math.abs(operation.stableChange) >= 1000 ?
                    (operation.stableChange / 1000).toFixed(1) + 'k' :
                    operation.stableChange.toFixed(0)
                  }
                </span>
              </div>

              <div className="mobile-amount-item">
                <span className="mobile-amount-label">{nativeSymbol} Δ:</span>
                <span className={`mobile-amount-value ${operation.nativeChange >= 0 ? 'positive' : 'negative'}`}>
                  {operation.nativeChange >= 0 ? '+' : ''}{operation.nativeChange.toFixed(2)}
                </span>
              </div>

              <div className="mobile-amount-item">
                <span className="mobile-amount-label">Cum. {stableSymbol}:</span>
                <span className={`mobile-amount-value ${operation.cumulativeStable >= 0 ? 'positive' : 'negative'}`}>
                  {Math.abs(operation.cumulativeStable) >= 1000 ?
                    (operation.cumulativeStable / 1000).toFixed(1) + 'k' :
                    operation.cumulativeStable.toFixed(0)
                  }
                </span>
              </div>

              <div className="mobile-amount-item">
                <span className="mobile-amount-label">Cum. {nativeSymbol}:</span>
                <span className={`mobile-amount-value ${operation.cumulativeNative >= 0 ? 'positive' : 'negative'}`}>
                  {operation.cumulativeNative.toFixed(2)}
                </span>
              </div>

              <div className="mobile-amount-item">
                <span className="mobile-amount-label">Fees:</span>
                <span className="mobile-amount-value">
                  {operation.cumulativeFeesUSD >= 1000 ?
                    (operation.cumulativeFeesUSD / 1000).toFixed(1) + 'k' :
                    operation.cumulativeFeesUSD.toFixed(0)
                  }
                </span>
              </div>

              <div className="mobile-amount-item">
                <span className="mobile-amount-label">Price:</span>
                <span className="mobile-amount-value">${operation.nativePrice.toFixed(0)}</span>
              </div>
            </div>

            {operation.type === 'POSITION_CLOSE' && (
              <div className="mobile-card-pnl">
                <div className="mobile-pnl-value">
                  PnL: ${Math.abs(operation.totalUSDValue) >= 1000 ?
                    (operation.totalUSDValue / 1000).toFixed(1) + 'k' :
                    operation.totalUSDValue.toFixed(0)
                  }
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function getRowClassName(type: string): string {
  switch (type) {
    case 'SWAP':
      return 'swap-row'
    case 'POSITION_OPEN':
      return 'position-open-row'
    case 'POSITION_CLOSE':
      return 'position-close-row'
    default:
      return ''
  }
}

export default PnLPage