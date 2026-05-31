import { useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LiquidityPool } from "./index";
import PoolTable from "./PoolTable";
import BitSharesService from "./BitSharesService";
import { IOXLM_POOL_IDS } from "./config";

const XLMPools = () => {
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xlmPrice, setXlmPriceState] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPools();
    fetchXLMPrice();
  }, []);

  const fetchXLMPrice = async () => {
    try {
      const response = await fetch('https://api.coinpaprika.com/v1/tickers/xlm-stellar');
      const data = await response.json();
      setXlmPriceState(data.quotes.USD.price);
    } catch (error) {
      console.error('Error fetching XLM price:', error);
      setXlmPriceState(0.12); // Fallback price
    }
  };

  const fetchPools = async () => {
    try {
      setLoading(true);
      setError(null);
      await BitSharesService.connect();
      const xlmPools = await BitSharesService.getPools(IOXLM_POOL_IDS);
      setPools(xlmPools);
    } catch (error) {
      console.error('Error fetching XLM pools:', error);
      setError('Failed to fetch XLM pool data.');
      setPools([]);
    } finally {
      setLoading(false);
    }
  };

  const totalTVL = pools.reduce((acc, p) => acc + BitSharesService.calculateTVL(p), 0);

  const handleSwap = (poolId: string) => {
    toast({
      title: "Swap functionality",
      description: `Swap functionality for pool ${poolId} will be implemented soon.`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-card border-primary/20 shadow-glow/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active XLM Pools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{pools.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently trading</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-primary/20 shadow-glow/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">XLM Price</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                ${xlmPrice?.toFixed(4) || '0.0000'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Current market price</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-primary/20 shadow-glow/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">TVL (XLM)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {BitSharesService.formatTVL(totalTVL, 'XLM')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ${(totalTVL * (xlmPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD equivalent
              </p>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Card className="bg-destructive/10 border-destructive mb-8">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-destructive mb-2">Connection Error</h3>
                  <p className="text-destructive/80">{error}</p>
                </div>
                <Button 
                  onClick={fetchPools}
                  variant="destructive"
                  size="sm"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-foreground">XLM Pool Overview</h2>
              <Button
                onClick={fetchPools}
                variant="outline"
                size="sm"
                disabled={loading}
                className="bg-background/80 hover:bg-background border-primary/30 hover:border-primary/50"
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            
            <PoolTable 
              pools={pools} 
              loading={loading} 
              onSwap={handleSwap}
              poolType="XLM"
            />
          </div>
        </div>

        <div className="mt-12 text-center">
          <Button 
            onClick={() => window.location.href = '/account'}
            className="bg-gradient-primary hover:bg-gradient-primary/90 text-primary-foreground shadow-glow hover:shadow-glow/80 transition-all duration-300"
            size="lg"
          >
            View Account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default XLMPools;