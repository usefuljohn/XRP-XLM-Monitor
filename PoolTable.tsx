import React from 'react';
import { LiquidityPool } from './index';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface PoolTableProps {
  pools: LiquidityPool[];
  loading: boolean;
  onSwap: (poolId: string) => void;
  poolType?: 'XRP' | 'XLM';
}

const PoolTable: React.FC<PoolTableProps> = ({ pools, loading, onSwap, poolType = 'XRP' }) => {
  if (loading) {
    return <div className="text-center py-10">Loading pool data...</div>;
  }

  return (
    <div className="rounded-md border border-border/50 bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pool</TableHead>
            <TableHead>Asset A</TableHead>
            <TableHead>Asset B</TableHead>
            <TableHead className="text-right">TVL</TableHead>
            <TableHead className="text-right">APY</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pools.map((pool) => (
            <TableRow key={pool.id}>
              <TableCell className="font-medium">{pool.name}</TableCell>
              <TableCell>{(pool.assetA.amount / Math.pow(10, pool.assetA.precision)).toFixed(4)} {pool.assetA.symbol}</TableCell>
              <TableCell>{(pool.assetB.amount / Math.pow(10, pool.assetB.precision)).toFixed(4)} {pool.assetB.symbol}</TableCell>
              <TableCell className="text-right font-mono">
                {pool.volume24h?.toFixed(2)} {poolType}
              </TableCell>
              <TableCell className="text-right text-success font-bold">
                {pool.apy?.toFixed(2)}%
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => onSwap(pool.id)}>
                  Swap
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PoolTable;
