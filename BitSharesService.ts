import { Apis } from "bitsharesjs-ws";
import { LiquidityPool, AssetInfo, SwapOperation, SwapVolume } from "./index";
import { IOXRP_POOL_IDS, IOXLM_POOL_IDS, DEFAULT_NODE } from "./config";

class BitSharesService {
  private static instance: BitSharesService;
  private isConnected = false;
  private nodeUrl = DEFAULT_NODE;
  private connectionPromise: Promise<boolean> | null = null;

  private constructor() {}

  public static getInstance(): BitSharesService {
    if (!BitSharesService.instance) {
      BitSharesService.instance = new BitSharesService();
    }
    return BitSharesService.instance;
  }

  public async connect(customNode?: string): Promise<boolean> {
    if (customNode) {
      this.nodeUrl = customNode;
      this.isConnected = false; // Force reconnect if node changed
    }

    const wsInstance = Apis.instance().ws_rpc;
    if (this.isConnected && wsInstance && wsInstance.ws && wsInstance.ws.readyState === WebSocket.OPEN) {
      return true;
    }
    
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise<boolean>(async (resolve) => {
      try {
        await Apis.close();
        const res = await Apis.instance(this.nodeUrl, true).init_promise;
        console.log("Connected to:", res[0].network);
        
        const ws = Apis.instance().ws_rpc.ws;
        if (ws) {
          ws.addEventListener('close', () => {
            console.log("WebSocket connection closed");
            this.isConnected = false;
          });
          
          ws.addEventListener('error', (error) => {
            console.error("WebSocket error:", error);
            this.isConnected = false;
          });
        }
        
        this.isConnected = true;
        resolve(true);
      } catch (err) {
        console.error("Connection error:", err);
        this.isConnected = false;
        resolve(false);
      } finally {
        this.connectionPromise = null;
      }
    });

    return this.connectionPromise;
  }

  private async ensureConnection(): Promise<void> {
    const wsInstance = Apis.instance().ws_rpc;
    const isActuallyConnected = this.isConnected && 
      wsInstance && 
      wsInstance.ws && 
      wsInstance.ws.readyState === WebSocket.OPEN;

    if (!isActuallyConnected) {
      this.isConnected = false;
      const connected = await this.connect();
      if (!connected) throw new Error("Failed to connect to BitShares network");
    }
  }

  public async getPools(poolIds: string[]): Promise<LiquidityPool[]> {
    await this.ensureConnection();
    
    try {
      const pools = await Apis.instance().db_api().exec("get_objects", [poolIds]);
      const validPools = pools.filter((pool: any) => pool !== null);
      
      const enhancedPools = await Promise.all(validPools.map(async (pool: any) => {
        try {
          const [assetA, assetB, volumeData] = await Promise.all([
            this.getAsset(pool.asset_a),
            this.getAsset(pool.asset_b),
            this.get24HourSwapVolume(pool.id)
          ]);
          
          const swapFee = pool.taker_fee_percent ? pool.taker_fee_percent / 10000 : 0.002; // Default 0.2%
          
          const poolData: LiquidityPool = {
            id: pool.id,
            name: `${assetA?.symbol}/${assetB?.symbol}`,
            assetA: {
              id: pool.asset_a,
              symbol: assetA?.symbol || 'Unknown',
              amount: pool.balance_a,
              precision: assetA?.precision || 0
            },
            assetB: {
              id: pool.asset_b,
              symbol: assetB?.symbol || 'Unknown',
              amount: pool.balance_b,
              precision: assetB?.precision || 0
            },
            volume24h: volumeData.volume24h,
            swapFee,
          };
          
          const tvl = this.calculateTVL(poolData);
          poolData.apy = this.calculateAPY(volumeData.volume24h, swapFee, tvl);
          
          return poolData;
        } catch (err) {
          console.error(`Error enhancing pool data for ${pool.id}:`, err);
          return null;
        }
      }));
      
      return enhancedPools.filter(pool => pool !== null) as LiquidityPool[];
    } catch (err) {
      console.error("Error fetching pools:", err);
      throw err;
    }
  }

  public async getAsset(assetId: string): Promise<AssetInfo | null> {
    await this.ensureConnection();
    try {
      const assets = await Apis.instance().db_api().exec("get_objects", [[assetId]]);
      const asset = assets[0];
      if (!asset) return null;
      
      return {
        id: asset.id,
        symbol: asset.symbol,
        precision: asset.precision,
        issuer: asset.issuer
      };
    } catch (err) {
      console.error(`Error fetching asset ${assetId}:`, err);
      return null;
    }
  }

  public calculateTVL(pool: LiquidityPool): number {
    // Standardized TVL: 2 * balance of the 'main' asset (XRP or XLM)
    const isMainAsset = (symbol: string) => 
      ['XRP', 'IOB.XRP', 'XLM', 'IOB.XLM', 'BTS'].includes(symbol.toUpperCase());

    let mainAsset = isMainAsset(pool.assetA.symbol) ? pool.assetA : 
                   isMainAsset(pool.assetB.symbol) ? pool.assetB : pool.assetA;
    
    const amount = mainAsset.amount / Math.pow(10, mainAsset.precision);
    return 2 * amount;
  }

  public calculateAPY(volume24h: number, swapFee: number, tvl: number): number {
    if (tvl === 0) return 0;
    const dailyFees = volume24h * swapFee;
    return (dailyFees / tvl) * 365 * 100;
  }

  public async get24HourSwapVolume(poolId: string): Promise<SwapVolume> {
    await this.ensureConnection();
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const operations = await this.getPoolOperations(poolId, oneDayAgo);
      const volume24h = await this.calculateVolumeInMainAsset(operations, poolId);
      
      return { poolId, volume24h, totalSwaps: operations.length };
    } catch (err) {
      return { poolId, volume24h: 0, totalSwaps: 0 };
    }
  }

  private async getPoolOperations(poolId: string, since: Date): Promise<SwapOperation[]> {
    try {
      const poolAccountId = poolId.replace('1.19.', '1.2.');
      const history = await Apis.instance().history_api().exec("get_account_history", [
        poolAccountId, "1.11.0", 100, "1.11.0"
      ]);
      
      const operations: SwapOperation[] = [];
      const sinceTimestamp = since.getTime();
      
      for (const item of history) {
        const op = item[1];
        if (op.op[0] === 83 && op.op[1].pool === poolId) {
          const blockTime = new Date(op.block_time + 'Z').getTime();
          if (blockTime >= sinceTimestamp) {
            operations.push({
              id: item[0],
              timestamp: op.block_time + 'Z',
              amount_a: parseInt(op.op[1].amount_to_sell.amount),
              amount_b: parseInt(op.op[1].min_to_receive.amount),
              pool_id: poolId
            });
          }
        }
      }
      return operations;
    } catch (err) { return []; }
  }

  private async calculateVolumeInMainAsset(operations: SwapOperation[], poolId: string): Promise<number> {
    if (operations.length === 0) return 0;
    const pools = await Apis.instance().db_api().exec("get_objects", [[poolId]]);
    const pool = pools[0];
    if (!pool) return 0;

    const [assetA, assetB] = await Promise.all([this.getAsset(pool.asset_a), this.getAsset(pool.asset_b)]);
    if (!assetA || !assetB) return 0;

    const isMain = (s: string) => ['XRP', 'XLM', 'BTS', 'IOB.XRP', 'IOB.XLM'].includes(s.toUpperCase());
    
    return operations.reduce((total, op) => {
      const amtA = op.amount_a / Math.pow(10, assetA.precision);
      const amtB = op.amount_b / Math.pow(10, assetB.precision);
      return total + (isMain(assetA.symbol) ? amtA : isMain(assetB.symbol) ? amtB : amtB);
    }, 0);
  }

  public formatTVL(tvl: number, symbol: string = 'XRP'): string {
    if (tvl >= 1000000) return `${(tvl / 1000000).toFixed(1)}M ${symbol}`;
    if (tvl >= 1000) return `${(tvl / 1000).toFixed(1)}K ${symbol}`;
    return `${tvl.toFixed(2)} ${symbol}`;
  }
}

export default BitSharesService.getInstance();
