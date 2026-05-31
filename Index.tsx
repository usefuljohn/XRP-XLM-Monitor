import { useState, useEffect } from "react";
import { LiquidityPool } from "./index";
import PoolTable from "./PoolTable";
import BitSharesService from "./BitSharesService";
import { IOXRP_POOL_IDS } from "./config";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import XLMPools from "./XLMPools";

const Index = () => {
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xrpPrice, setXrpPrice] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPools();
    fetchXRPPrice();
  }, []);

  const fetchXRPPrice = async () => {
    try {
      const response = await fetch('https://api.coinpaprika.com/v1/tickers/xrp-xrp');
      const data = await response.json();
      setXrpPrice(data.quotes.USD.price);
    } catch (err) {
      console.error("Error fetching XRP price:", err);
    }
  };

  const fetchPools = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await BitSharesService.connect();
      const xrpPools = await BitSharesService.getPools(IOXRP_POOL_IDS);
      setPools(xrpPools);
      
      toast({
        title: "Success",
        description: `Loaded ${xrpPools.length} XRP pools`,
      });
    } catch (err) {
      console.error("Error fetching pools:", err);
      setError("Failed to load XRP pools");
      toast({
        title: "Connection Error",
        description: "Failed to load XRP pools",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = (poolId: string) => {
    console.log(`Swap initiated for pool ${poolId}`);
    toast({
      title: "Swap Feature",
      description: `Swap functionality for pool ${poolId} will be implemented soon`,
      variant: "default"
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <img 
                  src="/lovable-uploads/a9a164bb-b391-4158-8b51-27ff5eb7ac84.png" 
                  alt="ioBanker Logo" 
                  className="w-12 h-12 object-contain"
                />
                <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  ioBanker Liquidity Pools
                </h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Real-time tracking of XRP and XLM liquidity pools on BitShares DEX
              </p>
            </div>
          </div>

          <Tabs defaultValue="xrp" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="xrp">XRP Pools</TabsTrigger>
              <TabsTrigger value="xlm">XLM Pools</TabsTrigger>
            </TabsList>
            
            <TabsContent value="xrp">{renderXRPContent()}</TabsContent>
            <TabsContent value="xlm"><XLMPools /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );

  function renderXRPContent() {
    return (
      <>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              XRP Pools
            </h2>
            <Button 
              onClick={fetchPools} 
              disabled={loading}
              variant="outline"
              className="border-primary/30 hover:border-primary hover:bg-primary/10"
            >
              {loading ? "Refreshing..." : "Refresh Pools"}
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-card border-border/50 p-6">
              <div className="text-2xl font-bold text-primary">{pools.length}</div>
              <div className="text-sm text-muted-foreground">Active Pools</div>
            </Card>
            <Card className="bg-gradient-card border-border/50 p-6">
              <div className="text-2xl font-bold text-success">
                ${xrpPrice ? xrpPrice.toFixed(4) : '---'}
              </div>
              <div className="text-sm text-muted-foreground">XRP Price</div>
            </Card>
            <Card className="bg-gradient-card border-border/50 p-6">
              <div className="text-2xl font-bold text-primary">
                {BitSharesService.formatTVL(pools.reduce((acc, p) => acc + BitSharesService.calculateTVL(p), 0))}
              </div>
              <div className="text-sm text-muted-foreground">TVL</div>
            </Card>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="bg-destructive/10 border-destructive/20 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-destructive font-semibold">{error}</p>
                <p className="text-destructive/80 text-sm mt-1">
                  Please check your internet connection and try again
                </p>
              </div>
              <Button 
                onClick={fetchPools}
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Pool Table */}
        <PoolTable 
          pools={pools} 
          loading={loading}
          onSwap={handleSwap}
        />

        {/* Footer Button */}
        <div className="mt-12 flex justify-center">
          <Button 
            onClick={() => window.location.href = '/account'}
            variant="outline"
            size="lg"
            className="border-primary/30 hover:border-primary hover:bg-primary/10"
          >
            View Account
          </Button>
        </div>
      </>
    );
  }
};

export default Index;
