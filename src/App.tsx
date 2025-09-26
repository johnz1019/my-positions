import { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import PositionsDisplay from './components/PositionsDisplay'
import PnLPage from './components/PnLPage'
import './App.css'

const STORAGE_KEY = 'uniswap-positions-addresses'

function App() {
  const location = useLocation()
  const [inputText, setInputText] = useState('')
  const [addresses, setAddresses] = useState<string[]>(() => {
    // 从 localStorage 读取保存的地址
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSearch = () => {
    if (inputText.trim()) {
      // 支持多个地址，用逗号、空格或换行分隔
      const newAddresses = inputText
        .split(/[\s,\n]+/)
        .map(addr => addr.trim())
        .filter(addr => addr.startsWith('0x') && addr.length === 42)
        .filter((addr, index, self) => self.indexOf(addr) === index) // 去重

      if (newAddresses.length > 0) {
        setAddresses(newAddresses)
        // 保存到 localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newAddresses))
        // 清空输入框
        setInputText('')
        setIsExpanded(false)
      }
    }
  }

  const handleAddAddress = () => {
    if (inputText.trim()) {
      const newAddresses = inputText
        .split(/[\s,\n]+/)
        .map(addr => addr.trim())
        .filter(addr => addr.startsWith('0x') && addr.length === 42)

      const combined = [...addresses, ...newAddresses]
        .filter((addr, index, self) => self.indexOf(addr) === index) // 去重

      if (combined.length > addresses.length) {
        setAddresses(combined)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined))
        setInputText('')
        setIsExpanded(false)
      }
    }
  }

  const handleRemoveAddress = (addressToRemove: string) => {
    const newAddresses = addresses.filter(addr => addr !== addressToRemove)
    setAddresses(newAddresses)
    if (newAddresses.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAddresses))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const handleClear = () => {
    setAddresses([])
    setInputText('')
    localStorage.removeItem(STORAGE_KEY)
  }

  useEffect(() => {
    // 当组件加载时，如果有保存的地址，自动加载
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setAddresses(JSON.parse(saved))
    }
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="nav-section">
          <h1>Uniswap Positions</h1>
          <nav className="main-nav">
            <Link
              to="/"
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              Positions
            </Link>
            <Link
              to="/pnl"
              className={`nav-link ${location.pathname === '/pnl' ? 'active' : ''}`}
            >
              PnL Analysis
            </Link>
          </nav>
        </div>

        {location.pathname === '/' && (
          <div className="search-section">
            <div className={`search-box ${isExpanded ? 'expanded' : ''}`}>
              {isExpanded ? (
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Enter addresses (0x...)"
                  className="address-input-multi"
                  rows={2}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addresses.length > 0 ? handleAddAddress() : handleSearch()
                    }
                    if (e.key === 'Escape') {
                      setIsExpanded(false)
                      setInputText('')
                    }
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Add wallet address..."
                  className="address-input-single"
                  onFocus={() => setIsExpanded(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addresses.length > 0 ? handleAddAddress() : handleSearch()
                    }
                  }}
                />
              )}

              <div className="search-actions">
                {addresses.length === 0 ? (
                  <button
                    onClick={handleSearch}
                    className="btn-primary"
                    disabled={!inputText.trim()}
                  >
                    Search
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleAddAddress}
                      className="btn-add"
                      disabled={!inputText.trim()}
                    >
                      + Add
                    </button>
                    {isExpanded && (
                      <button
                        onClick={() => {
                          setIsExpanded(false)
                          setInputText('')
                        }}
                        className="btn-cancel"
                      >
                        Cancel
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {addresses.length > 0 && (
              <div className="active-addresses">
                <div className="address-chips">
                  {addresses.map((addr) => (
                    <div key={addr} className="address-chip">
                      <span>{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                      <button
                        className="chip-remove"
                        onClick={() => handleRemoveAddress(addr)}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {addresses.length > 0 && (
                  <button onClick={handleClear} className="btn-clear-all">
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      <main className="app-content">
        <Routes>
          <Route
            path="/"
            element={addresses.length > 0 ? <PositionsDisplay addresses={addresses} /> : <div className="no-addresses">Add wallet addresses to view positions</div>}
          />
          <Route path="/pnl" element={<PnLPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App