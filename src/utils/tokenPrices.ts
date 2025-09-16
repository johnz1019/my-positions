// Token price fetching utilities using CoinGecko API

interface TokenPrice {
  [address: string]: {
    usd: number
  }
}

// Common token addresses on Ethereum mainnet
const TOKEN_ADDRESSES: { [symbol: string]: string } = {
  'UNI': '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  'WETH': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  'WBTC': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  'LINK': '0x514910771af9ca656af840dff83e8264ecf986ca',
  'AAVE': '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  'CRV': '0xd533a949740bb3306d119cc777fa900ba034cd52',
  'MKR': '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
  'SNX': '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
  'COMP': '0xc00e94cb662c3520282e6f5717214004a7f26888',
  'YFI': '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
}

// Cache for token prices
const priceCache: Map<string, { price: number; timestamp: number }> = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Try multiple price sources in order
async function fetchFromDexScreener(addresses: string[]): Promise<TokenPrice | null> {
  try {
    const result: TokenPrice = {}

    // DexScreener API - fetch each token individually (no bulk endpoint)
    for (const address of addresses) {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`
      const response = await fetch(url)

      if (response.ok) {
        const data = await response.json()
        if (data.pairs && data.pairs.length > 0) {
          // Get the price from the first pair (usually highest liquidity)
          const price = parseFloat(data.pairs[0].priceUsd)
          if (price > 0) {
            result[address.toLowerCase()] = { usd: price }
          }
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null
  } catch (error) {
    console.error('DexScreener API error:', error)
    return null
  }
}

async function fetchFromLlamaFi(addresses: string[]): Promise<TokenPrice | null> {
  try {
    // DefiLlama API
    const addressList = addresses.map(a => `ethereum:${a}`).join(',')
    const url = `https://coins.llama.fi/prices/current/${addressList}`

    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()
    const result: TokenPrice = {}

    if (data.coins) {
      Object.entries(data.coins).forEach(([key, value]: [string, any]) => {
        const address = key.replace('ethereum:', '').toLowerCase()
        if (value.price) {
          result[address] = { usd: value.price }
        }
      })
    }

    return Object.keys(result).length > 0 ? result : null
  } catch (error) {
    console.error('DefiLlama API error:', error)
    return null
  }
}

async function fetchFromCoinGecko(addresses: string[]): Promise<TokenPrice | null> {
  try {
    const addressList = addresses.join(',').toLowerCase()
    const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${addressList}&vs_currencies=usd`

    const response = await fetch(url)
    if (!response.ok) {
      // If rate limited, return null to try next source
      if (response.status === 429) {
        console.warn('CoinGecko rate limit reached')
        return null
      }
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('CoinGecko API error:', error)
    return null
  }
}

export async function getTokenPrices(addresses: string[]): Promise<TokenPrice> {
  try {
    // Filter out addresses that are cached and still fresh
    const now = Date.now()
    const addressesToFetch = addresses.filter(addr => {
      const cached = priceCache.get(addr.toLowerCase())
      return !cached || (now - cached.timestamp) > CACHE_DURATION
    })

    if (addressesToFetch.length === 0) {
      // Return cached prices
      const result: TokenPrice = {}
      addresses.forEach(addr => {
        const cached = priceCache.get(addr.toLowerCase())
        if (cached) {
          result[addr.toLowerCase()] = { usd: cached.price }
        }
      })
      return result
    }

    // Try multiple sources in order
    let data: TokenPrice | null = null

    // 1. Try DefiLlama first (good rate limits, reliable)
    data = await fetchFromLlamaFi(addressesToFetch)

    // 2. If DefiLlama fails, try DexScreener
    if (!data) {
      data = await fetchFromDexScreener(addressesToFetch)
    }

    // 3. If both fail, try CoinGecko as last resort
    if (!data) {
      data = await fetchFromCoinGecko(addressesToFetch)
    }

    // If all sources fail, return cached data if available
    if (!data) {
      console.warn('All price sources failed, using cached data')
      data = {}
    }

    // Update cache
    Object.entries(data).forEach(([address, priceData]: [string, any]) => {
      priceCache.set(address.toLowerCase(), {
        price: priceData.usd,
        timestamp: now
      })
    })

    // Include cached prices in result
    const result: TokenPrice = { ...data }
    addresses.forEach(addr => {
      const addrLower = addr.toLowerCase()
      if (!result[addrLower]) {
        const cached = priceCache.get(addrLower)
        if (cached) {
          result[addrLower] = { usd: cached.price }
        }
      }
    })

    return result
  } catch (error) {
    console.error('Error fetching token prices:', error)
    // Return cached prices on error
    const result: TokenPrice = {}
    addresses.forEach(addr => {
      const cached = priceCache.get(addr.toLowerCase())
      if (cached) {
        result[addr.toLowerCase()] = { usd: cached.price }
      }
    })
    return result
  }
}

export async function getTokenPriceBySymbol(symbol: string): Promise<number | null> {
  const address = TOKEN_ADDRESSES[symbol.toUpperCase()]
  if (!address) {
    return null
  }

  const prices = await getTokenPrices([address])
  return prices[address.toLowerCase()]?.usd || null
}

// Get multiple token prices by symbols
export async function getTokenPricesBySymbols(symbols: string[]): Promise<{ [symbol: string]: number }> {
  const addresses = symbols
    .map(s => TOKEN_ADDRESSES[s.toUpperCase()])
    .filter(Boolean)

  if (addresses.length === 0) {
    return {}
  }

  const prices = await getTokenPrices(addresses)
  const result: { [symbol: string]: number } = {}

  symbols.forEach(symbol => {
    const address = TOKEN_ADDRESSES[symbol.toUpperCase()]
    if (address && prices[address.toLowerCase()]) {
      result[symbol.toUpperCase()] = prices[address.toLowerCase()].usd
    }
  })

  return result
}