import { Price, Token as UniswapToken } from '@uniswap/sdk-core'
import { tickToPrice } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

/**
 * 将 sqrtPriceX96 转换为实际价格
 * sqrtPriceX96 = sqrt(price) * 2^96
 * price = (sqrtPriceX96 / 2^96)^2
 *
 * 这个价格是 token1/token0 的价格（即需要多少 token0 来换取 1 个 token1）
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: string,
  token0Decimals: number,
  token1Decimals: number,
  invert: boolean = false
): number {
  // 将 sqrtPriceX96 转换为 BigInt
  const sqrtPriceX96Big = JSBI.BigInt(sqrtPriceX96)

  // 2^96
  const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

  // 计算 price = (sqrtPriceX96 / 2^96)^2
  // 这给出的是原始价格（不考虑小数位）
  const priceX192 = JSBI.multiply(sqrtPriceX96Big, sqrtPriceX96Big)

  // 转换为浮点数并调整精度
  // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
  const price = Number(priceX192.toString()) / Math.pow(2, 192)

  // 调整小数位差异
  // 如果 token0 有 18 位小数，token1 有 6 位小数
  // 原始价格需要乘以 10^(18-6) = 10^12
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals)
  const adjustedPrice = price * decimalAdjustment

  return invert ? 1 / adjustedPrice : adjustedPrice
}

/**
 * 将 tick 转换为价格
 */
export function tickToPriceSimple(
  tick: number,
  token0Decimals: number,
  token1Decimals: number,
  invert: boolean = false
): number {
  // price = 1.0001^tick
  const price = Math.pow(1.0001, tick)

  // 调整小数位
  // price 是 token1/token0 的原始比例
  // 需要调整为考虑小数位差异后的价格
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals)
  const adjustedPrice = price * decimalAdjustment

  return invert ? 1 / adjustedPrice : adjustedPrice
}

/**
 * 使用 Uniswap SDK 计算价格（更精确）
 */
export function calculatePriceFromTick(
  tick: number,
  token0: { address: string; decimals: number; symbol: string; name: string; chainId: number },
  token1: { address: string; decimals: number; symbol: string; name: string; chainId: number }
): { price: number; inverted: number } {
  try {
    // 创建 Token 实例
    const tokenA = new UniswapToken(
      token0.chainId,
      token0.address,
      token0.decimals,
      token0.symbol,
      token0.name
    )

    const tokenB = new UniswapToken(
      token1.chainId,
      token1.address,
      token1.decimals,
      token1.symbol,
      token1.name
    )

    // 使用 SDK 的 tickToPrice 函数
    const price = tickToPrice(tokenA, tokenB, tick)

    return {
      price: parseFloat(price.toSignificant(6)),
      inverted: parseFloat(price.invert().toSignificant(6))
    }
  } catch (error) {
    console.error('Error calculating price from tick:', error)
    // 降级到简单计算
    const price = tickToPriceSimple(tick, token0.decimals, token1.decimals)
    return { price, inverted: 1 / price }
  }
}

/**
 * 检查是否为稳定币
 */
export function isStablecoin(symbol: string): boolean {
  const stablecoins = ['USDT', 'USDC', 'USD', 'DAI', 'BUSD', 'TUSD', 'USDP', 'GUSD', 'USD₮0']
  return stablecoins.some(stable => symbol.toUpperCase().includes(stable.toUpperCase()))
}

/**
 * 决定价格显示方向（以稳定币为基础）
 *
 * @param price - token1/token0 的价格（即 1 个 token0 值多少 token1）
 */
export function getPriceDisplay(
  price: number,
  token0: { symbol: string },
  token1: { symbol: string }
): { displayPrice: number; baseSymbol: string; quoteSymbol: string } {
  const token0IsStable = isStablecoin(token0.symbol)
  const token1IsStable = isStablecoin(token1.symbol)

  // 如果 token1 是稳定币，显示 token0 的价格（以 token1 计价）
  // price 是 1 token0 = price token1，这正是我们想要的
  if (token1IsStable && !token0IsStable) {
    return {
      displayPrice: price,  // 直接使用：1 token0 = price token1
      baseSymbol: token0.symbol,
      quoteSymbol: token1.symbol
    }
  }

  // 如果 token0 是稳定币，显示 token1 的价格（以 token0 计价）
  // price 是 1 token0 = price token1，需要反转为 1 token1 = 1/price token0
  if (token0IsStable && !token1IsStable) {
    return {
      displayPrice: 1 / price,  // 反转：1 token1 = 1/price token0
      baseSymbol: token1.symbol,
      quoteSymbol: token0.symbol
    }
  }

  // 如果都不是稳定币或都是稳定币，默认显示 token0 的价格
  return {
    displayPrice: price,
    baseSymbol: token0.symbol,
    quoteSymbol: token1.symbol
  }
}

/**
 * 格式化价格显示
 */
export function formatPrice(price: number, includeSymbol: boolean = false): string {
  const prefix = includeSymbol ? '$' : ''
  if (price === 0) return `${prefix}0`
  if (price < 0.000001) return `${prefix}${price.toExponential(2)}`
  if (price < 0.01) return `${prefix}${price.toFixed(6)}`
  if (price < 1) return `${prefix}${price.toFixed(4)}`
  if (price < 10000) return `${prefix}${price.toFixed(2)}`
  // 对于大数字，使用千位分隔符
  return `${prefix}${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * 计算价格范围
 */
export function calculatePriceRange(
  tickLower: string,
  tickUpper: string,
  currentTick: string,
  token0: { address: string; decimals: number; symbol: string; name: string; chainId: number },
  token1: { address: string; decimals: number; symbol: string; name: string; chainId: number }
) {
  const lowerTick = parseInt(tickLower)
  const upperTick = parseInt(tickUpper)
  const currentTickNum = parseInt(currentTick)

  const { price: priceLower } = calculatePriceFromTick(lowerTick, token0, token1)
  const { price: priceUpper } = calculatePriceFromTick(upperTick, token0, token1)
  const { price: currentPrice } = calculatePriceFromTick(currentTickNum, token0, token1)

  return {
    priceLower,
    priceUpper,
    currentPrice,
    isInRange: currentTickNum >= lowerTick && currentTickNum <= upperTick
  }
}