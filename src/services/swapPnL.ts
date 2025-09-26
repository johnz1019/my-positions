import axios from 'axios';
import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';

export interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

export interface OrderRecord {
  fromToken: string;
  toToken: string;
  sender: string;
  fromAmount: string;
  returnAmount: string;
  transactionHash: string;
  blockNumber: string;
  timestamp: string;
  gasUsed: string;
  gasPrice: string;
}

export interface SwapPnLData {
  transactions: OrderRecord[];
  tokenSummary: Record<string, {
    totalIn: bigint;
    totalOut: bigint;
    netAmount: bigint;
    transactionCount: number;
  }>;
  totalGasCost: bigint;
  profitableSwaps: number;
  unprofitableSwaps: number;
}

export class SwapPnLService {
  private etherscanApiKey: string;
  private rpcProvider: ethers.JsonRpcProvider;
  private baseUrl = 'https://api.etherscan.io/v2/api';
  private cacheDir: string;

  constructor(etherscanApiKey: string, rpcUrl?: string, cacheDir = '.cache') {
    this.etherscanApiKey = etherscanApiKey;
    this.rpcProvider = new ethers.JsonRpcProvider(rpcUrl || 'https://eth.llamarpc.com');
    this.cacheDir = cacheDir;
  }

  // OrderRecord event signature: OrderRecord(address,address,address,uint256,uint256)
  private readonly ORDER_RECORD_TOPIC = ethers.id('OrderRecord(address,address,address,uint256,uint256)');

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create cache directory:', error);
    }
  }

  private getCacheFilePath(transactionHash: string): string {
    return path.join(this.cacheDir, `receipt_${transactionHash}.json`);
  }

  private async loadReceiptFromCache(transactionHash: string): Promise<any | null> {
    try {
      const cacheFile = this.getCacheFilePath(transactionHash);
      const data = await fs.readFile(cacheFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  private async saveReceiptToCache(transactionHash: string, receipt: any): Promise<void> {
    try {
      await this.ensureCacheDir();
      const cacheFile = this.getCacheFilePath(transactionHash);
      await fs.writeFile(cacheFile, JSON.stringify(receipt, null, 2));
    } catch (error) {
      console.warn('Failed to save receipt to cache:', error);
    }
  }

  async getTransactionsByAddress(address: string, chainId: number, startBlock = 0, endBlock = 99999999): Promise<EtherscanTransaction[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          chainid: chainId,
          module: 'account',
          action: 'txlist',
          address: address,
          startblock: startBlock,
          endblock: endBlock,
          page: 1,
          offset: 10000,
          sort: 'desc',
          apikey: this.etherscanApiKey
        }
      });

      if (response.data.status !== '1') {
        throw new Error(`Etherscan API error: ${response.data.message}`);
      }

      return response.data.result;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error(`Failed to fetch transactions: ${error}`);
    }
  }

  filterSmartSwapTransactions(transactions: EtherscanTransaction[]): EtherscanTransaction[] {
    // smartSwapByOrderId method signature
    const smartSwapMethodId = '0x'; // We'll filter by function name instead

    return transactions.filter(tx =>
      tx.functionName &&
      tx.functionName.includes('smartSwapByOrderId') &&
      tx.isError === '0' &&
      tx.txreceipt_status === '1'
    );
  }

  async parseOrderRecordEvents(transactionHash: string): Promise<OrderRecord[]> {
    try {
      // Check file cache first
      let receipt = await this.loadReceiptFromCache(transactionHash);

      if (!receipt) {
        console.log(`Fetching receipt for ${transactionHash}`);
        const rawReceipt = await this.rpcProvider.getTransactionReceipt(transactionHash);
        if (!rawReceipt) {
          throw new Error(`Receipt not found for transaction ${transactionHash}`);
        }

        // Convert receipt to plain object for caching
        receipt = {
          blockNumber: rawReceipt.blockNumber,
          blockHash: rawReceipt.blockHash,
          transactionIndex: rawReceipt.index,
          transactionHash: rawReceipt.hash,
          from: rawReceipt.from,
          to: rawReceipt.to,
          gasUsed: rawReceipt.gasUsed.toString(),
          gasPrice: rawReceipt.gasPrice?.toString() || '0',
          logs: rawReceipt.logs.map(log => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            transactionIndex: log.transactionIndex,
            blockHash: log.blockHash,
            logIndex: log.index,
            removed: log.removed
          }))
        };

        // Save to cache
        await this.saveReceiptToCache(transactionHash, receipt);
      } else {
        console.log(`Using cached receipt for ${transactionHash}`);
      }

      const orderRecords: OrderRecord[] = [];

      for (const log of receipt.logs) {
        if (log.topics[0] === this.ORDER_RECORD_TOPIC) {
          try {
            // Decode the OrderRecord event
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
              ['address', 'address', 'address', 'uint256', 'uint256'],
              log.data
            );

            const orderRecord: OrderRecord = {
              fromToken: decoded[0],
              toToken: decoded[1],
              sender: decoded[2],
              fromAmount: decoded[3].toString(),
              returnAmount: decoded[4].toString(),
              transactionHash: transactionHash,
              blockNumber: receipt.blockNumber.toString(),
              timestamp: '', // Will be filled later
              gasUsed: receipt.gasUsed.toString(),
              gasPrice: receipt.gasPrice?.toString() || '0'
            };

            orderRecords.push(orderRecord);
          } catch (decodeError) {
            console.warn(`Failed to decode OrderRecord event in tx ${transactionHash}:`, decodeError);
          }
        }
      }

      return orderRecords;
    } catch (error) {
      console.error(`Error parsing events for transaction ${transactionHash}:`, error);
      return [];
    }
  }

  async getBlockTimestamp(blockNumber: string): Promise<string> {
    try {
      const block = await this.rpcProvider.getBlock(parseInt(blockNumber));
      return block?.timestamp.toString() || '0';
    } catch (error) {
      console.error(`Error getting block timestamp for ${blockNumber}:`, error);
      return '0';
    }
  }

  async getSwapPnLData(address: string, startBlock = 0, endBlock = 99999999): Promise<SwapPnLData> {
    try {
      console.log(`Fetching transactions for address: ${address}`);

      // Step 1: Get all transactions
      const allTransactions = await this.getTransactionsByAddress(address, 56, startBlock, endBlock);
      console.log(`Found ${allTransactions.length} total transactions`);

      // Step 2: Filter smartSwapByOrderId transactions
      const smartSwapTxs = this.filterSmartSwapTransactions(allTransactions);
      console.log(`Found ${smartSwapTxs.length} smartSwapByOrderId transactions`);

      // Step 3: Parse OrderRecord events from each transaction
      const allOrderRecords: OrderRecord[] = [];
      let totalGasCost = 0n;

      for (const tx of smartSwapTxs) {
        console.log(`Processing transaction: ${tx.hash}`);

        const orderRecords = await this.parseOrderRecordEvents(tx.hash);

        // Fill in timestamp and calculate gas cost
        const timestamp = tx.timeStamp;
        const gasCost = BigInt(tx.gasUsed) * BigInt(tx.gasPrice);
        totalGasCost += gasCost;

        for (const record of orderRecords) {
          record.timestamp = timestamp;
          allOrderRecords.push(record);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 4: Calculate token summary and PnL
      const tokenSummary: Record<string, {
        totalIn: bigint;
        totalOut: bigint;
        netAmount: bigint;
        transactionCount: number;
      }> = {};

      let profitableSwaps = 0;
      let unprofitableSwaps = 0;

      for (const record of allOrderRecords) {
        const fromAmount = BigInt(record.fromAmount);
        const returnAmount = BigInt(record.returnAmount);

        // Track fromToken (outgoing)
        if (!tokenSummary[record.fromToken]) {
          tokenSummary[record.fromToken] = {
            totalIn: 0n,
            totalOut: 0n,
            netAmount: 0n,
            transactionCount: 0
          };
        }
        tokenSummary[record.fromToken].totalOut += fromAmount;
        tokenSummary[record.fromToken].netAmount -= fromAmount;
        tokenSummary[record.fromToken].transactionCount++;

        // Track toToken (incoming)
        if (!tokenSummary[record.toToken]) {
          tokenSummary[record.toToken] = {
            totalIn: 0n,
            totalOut: 0n,
            netAmount: 0n,
            transactionCount: 0
          };
        }
        tokenSummary[record.toToken].totalIn += returnAmount;
        tokenSummary[record.toToken].netAmount += returnAmount;

        // Simple profitability check (this is basic, real PnL needs price data)
        if (returnAmount > fromAmount) {
          profitableSwaps++;
        } else {
          unprofitableSwaps++;
        }
      }

      return {
        transactions: allOrderRecords,
        tokenSummary,
        totalGasCost,
        profitableSwaps,
        unprofitableSwaps
      };

    } catch (error) {
      console.error('Error calculating swap PnL:', error);
      throw new Error(`Failed to calculate swap PnL: ${error}`);
    }
  }

  formatTokenAmount(amount: string, decimals = 18): string {
    return ethers.formatUnits(amount, decimals);
  }

  formatEther(amount: string): string {
    return ethers.formatEther(amount);
  }

  async getTokenInfo(tokenAddress: string): Promise<{symbol: string, decimals: number}> {
    try {
      // Handle native ETH address
      if (tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
        return { symbol: 'ETH', decimals: 18 };
      }

      // Basic ERC20 ABI for symbol and decimals
      const erc20Abi = [
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ];

      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.rpcProvider);
      const [symbol, decimals] = await Promise.all([
        contract.symbol(),
        contract.decimals()
      ]);

      return { symbol, decimals: Number(decimals) };
    } catch (error) {
      console.warn(`Failed to get token info for ${tokenAddress}:`, error);
      return { symbol: `Token(${tokenAddress.slice(0, 8)}...)`, decimals: 18 };
    }
  }
}

export default SwapPnLService;