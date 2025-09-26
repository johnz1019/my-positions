import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

interface PricePoint {
  timestamp: number;
  price: number;
}

interface CachedPriceData {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  data: PricePoint[];
  cachedAt: number;
}

export class HistoricalPriceService {
  private cacheDir: string;

  constructor(cacheDir = '.cache/prices') {
    this.cacheDir = cacheDir;
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create price cache directory:', error);
    }
  }

  private getCacheFilePath(symbol: string, interval: string): string {
    return path.join(this.cacheDir, `${symbol}_${interval}.json`);
  }

  private async loadFromCache(symbol: string, interval: string): Promise<CachedPriceData | null> {
    try {
      const cacheFile = this.getCacheFilePath(symbol, interval);
      const data = await fs.readFile(cacheFile, 'utf-8');
      const cached: CachedPriceData = JSON.parse(data);

      // 检查缓存是否还有效（24小时内）
      const now = Date.now();
      const cacheAge = now - cached.cachedAt;
      const maxAge = 24 * 60 * 60 * 1000; // 24小时

      if (cacheAge > maxAge) {
        console.log(`   Cache for ${symbol} is ${Math.round(cacheAge / (60 * 60 * 1000))} hours old, will refresh`);
        return null;
      }

      console.log(`   Loaded ${cached.data.length} cached price points for ${symbol}`);
      return cached;
    } catch (error) {
      return null;
    }
  }

  private async saveToCache(cacheData: CachedPriceData): Promise<void> {
    try {
      await this.ensureCacheDir();
      const cacheFile = this.getCacheFilePath(cacheData.symbol, cacheData.interval);
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
      console.log(`   Cached ${cacheData.data.length} price points for ${cacheData.symbol}`);
    } catch (error) {
      console.warn('Failed to save price data to cache:', error);
    }
  }

  private async fetchBinanceKlines(symbol: string, interval: string, startTime: number, endTime: number): Promise<PricePoint[]> {
    const allData: PricePoint[] = [];
    let currentStart = startTime;
    const batchSize = 1000;

    console.log(`   Fetching ${symbol} price data from Binance API...`);
    console.log(`   Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`);

    while (currentStart < endTime) {
      try {
        const response = await axios.get('https://api.binance.com/api/v3/klines', {
          params: {
            symbol: symbol,
            interval: interval,
            startTime: currentStart * 1000,
            endTime: endTime * 1000,
            limit: batchSize
          }
        });

        if (!response.data || response.data.length === 0) {
          break;
        }

        const batchData: PricePoint[] = response.data.map((kline: any[]) => ({
          timestamp: Math.floor(kline[0] / 1000),
          price: parseFloat(kline[4]) // 收盘价
        }));

        allData.push(...batchData);

        // 更新下一批的开始时间
        const lastTimestamp = batchData[batchData.length - 1].timestamp;
        currentStart = lastTimestamp + 60; // 下一分钟

        console.log(`   Fetched batch: ${batchData.length} points, total: ${allData.length}`);

        // 如果这批数据少于1000，说明已经获取完所有数据
        if (batchData.length < batchSize) {
          break;
        }

        // 添加延时避免API限制
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to fetch batch starting at ${new Date(currentStart * 1000).toISOString()}:`, error);
        break;
      }
    }

    console.log(`   Total fetched: ${allData.length} price points`);

    if (allData.length > 0) {
      console.log(`   First price: ${new Date(allData[0].timestamp * 1000).toISOString()} - $${allData[0].price}`);
      console.log(`   Last price: ${new Date(allData[allData.length - 1].timestamp * 1000).toISOString()} - $${allData[allData.length - 1].price}`);
    }

    return allData;
  }

  async getHistoricalPrices(symbol: string, startTime: number, endTime: number, interval: string = '1m'): Promise<PricePoint[]> {
    // 尝试从缓存加载
    const cached = await this.loadFromCache(symbol, interval);

    if (cached && cached.startTime <= startTime && cached.endTime >= endTime) {
      console.log(`   Using cached data for ${symbol} (${cached.data.length} points)`);

      // 过滤出请求时间范围内的数据
      const filteredData = cached.data.filter(
        point => point.timestamp >= startTime && point.timestamp <= endTime
      );

      console.log(`   Filtered to ${filteredData.length} points for requested range`);
      return filteredData;
    }

    // 从API获取数据
    const priceData = await this.fetchBinanceKlines(symbol, interval, startTime, endTime);

    // 缓存数据
    if (priceData.length > 0) {
      const cacheData: CachedPriceData = {
        symbol,
        interval,
        startTime,
        endTime,
        data: priceData,
        cachedAt: Date.now()
      };

      await this.saveToCache(cacheData);
    }

    return priceData;
  }

  // 获取指定时间点的价格（线性插值）
  getPriceAtTimestamp(priceData: PricePoint[], timestamp: number, debug: boolean = false): number {
    if (priceData.length === 0) {
      if (debug) console.log(`   No price data available, using default $600`);
      return 600;
    }

    const requestedTime = new Date(timestamp * 1000).toISOString();

    // 如果时间戳在范围外，使用边界价格
    if (timestamp <= priceData[0].timestamp) {
      if (debug) console.log(`   Time ${requestedTime} before first data point, using first price $${priceData[0].price}`);
      return priceData[0].price;
    }
    if (timestamp >= priceData[priceData.length - 1].timestamp) {
      if (debug) console.log(`   Time ${requestedTime} after last data point, using last price $${priceData[priceData.length - 1].price}`);
      return priceData[priceData.length - 1].price;
    }

    // 二分查找最接近的时间点
    let left = 0;
    let right = priceData.length - 1;

    while (left < right - 1) {
      const mid = Math.floor((left + right) / 2);
      if (priceData[mid].timestamp <= timestamp) {
        left = mid;
      } else {
        right = mid;
      }
    }

    // 线性插值
    const t1 = priceData[left].timestamp;
    const t2 = priceData[right].timestamp;
    const p1 = priceData[left].price;
    const p2 = priceData[right].price;

    if (t1 === t2) return p1;

    const ratio = (timestamp - t1) / (t2 - t1);
    const interpolatedPrice = p1 + (p2 - p1) * ratio;

    if (debug) {
      console.log(`   Interpolating for ${requestedTime}:`);
      console.log(`     Between ${new Date(t1 * 1000).toISOString()} ($${p1}) and ${new Date(t2 * 1000).toISOString()} ($${p2})`);
      console.log(`     Ratio: ${ratio.toFixed(4)}, Result: $${interpolatedPrice.toFixed(2)}`);
    }

    return interpolatedPrice;
  }

  // 清理过期缓存
  async cleanExpiredCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);

          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath);
            console.log(`   Cleaned expired cache: ${file}`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clean expired cache:', error);
    }
  }
}

export default HistoricalPriceService;