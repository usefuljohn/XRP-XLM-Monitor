export interface LiquidityPool {
  id: string;
  name: string;
  assetA: {
    id: string;
    symbol: string;
    amount: number;
    precision: number;
  };
  assetB: {
    id: string;
    symbol: string;
    amount: number;
    precision: number;
  };
  volume24h?: number;
  swapFee?: number;
  apy?: number;
}

export interface SwapOperation {
  id: string;
  timestamp: string;
  amount_a: number;
  amount_b: number;
  pool_id: string;
}

export interface SwapVolume {
  poolId: string;
  volume24h: number;
  totalSwaps: number;
}

export interface PoolConfig {
  id: string;
  displayName?: string;
  logoUrl?: string;
  isIOBXRPPool: boolean;
  priority: number;
}

export interface AssetInfo {
  id: string;
  symbol: string;
  precision: number;
  issuer?: string;
}