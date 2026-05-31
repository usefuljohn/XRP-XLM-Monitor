/**
 * path.js — IOB.XRP → BTS → IOB.XLM path engine
 *
 * This module is intentionally narrow: it only computes the single known
 * 1-hop route IOB.XRP → IOB.XLM via their shared BTS liquidity pools.
 *
 * Pool topology (as of chain state):
 *   Pool A  1.19.133  BTS (1.3.0) / IOB.XRP (1.3.5537)
 *   Pool B  1.19.399  BTS (1.3.0) / IOB.XLM (1.3.6444)
 *
 * Asset precisions:
 *   BTS      1.3.0     precision 5  (satoshi = 0.00001 BTS)
 *   IOB.XRP  1.3.5537  precision 4
 *   IOB.XLM  1.3.6444  precision 4
 */

import { getObjects } from "./rpc.js";

// ── Hardcoded asset & pool constants ────────────────────────────────────────

export const ASSETS = {
  BTS:     { id: "1.3.0",    symbol: "BTS",     precision: 5, icon: "bts" },
  IOB_XRP: { id: "1.3.5537", symbol: "IOB.XRP", precision: 4, icon: "xrp" },
  IOB_XLM: { id: "1.3.6444", symbol: "IOB.XLM", precision: 4, icon: "xlm" },
};

/**
 * Get the path for a given direction.
 * @param {boolean} isReverse — if true, swap XLM -> XRP
 */
export function getPath(isReverse = false) {
  if (isReverse) {
    return [
      {
        poolId:   "1.19.399",
        assetA:   ASSETS.BTS,
        assetB:   ASSETS.IOB_XLM,
        sell:     "B",   // sell IOB.XLM (B) to receive BTS (A)
        sellAsset: ASSETS.IOB_XLM,
        buyAsset:  ASSETS.BTS,
      },
      {
        poolId:   "1.19.133",
        assetA:   ASSETS.BTS,
        assetB:   ASSETS.IOB_XRP,
        sell:     "A",   // sell BTS (A) to receive IOB.XRP (B)
        sellAsset: ASSETS.BTS,
        buyAsset:  ASSETS.IOB_XRP,
      },
    ];
  }
  return [
    {
      poolId:   "1.19.133",
      assetA:   ASSETS.BTS,
      assetB:   ASSETS.IOB_XRP,
      sell:     "B",   // sell IOB.XRP (B) to receive BTS (A)
      sellAsset: ASSETS.IOB_XRP,
      buyAsset:  ASSETS.BTS,
    },
    {
      poolId:   "1.19.399",
      assetA:   ASSETS.BTS,
      assetB:   ASSETS.IOB_XLM,
      sell:     "A",   // sell BTS (A) to receive IOB.XLM (B)
      sellAsset: ASSETS.BTS,
      buyAsset:  ASSETS.IOB_XLM,
    },
  ];
}

// ── AMM formula ──────────────────────────────────────────────────────────────

/**
 * Constant-product AMM output (no fee applied here; fee is handled separately).
 *
 * dy = (y * dx) / (x + dx)
 *
 * @param {number} dx      — amount being sold (in human units)
 * @param {number} x       — reserve of the asset being sold
 * @param {number} y       — reserve of the asset being bought
 * @returns {number}       — amount received
 */
function cpOutput(dx, x, y) {
  return (y * dx) / (x + dx);
}

// ── Live pool state ──────────────────────────────────────────────────────────

/**
 * Fetch live balances and fee for both pools from the chain.
 *
 * @returns {Promise<Array<{
 *   poolId: string,
 *   balA: number,   // human-readable balance of assetA
 *   balB: number,   // human-readable balance of assetB
 *   takerFeeBps: number,  // taker fee in basis points (e.g. 30 = 0.30%)
 * }>>}
 */
export async function fetchPoolState() {
  const path = getPath(false); // pooled state is the same regardless of direction
  const ids = path.map(leg => leg.poolId);
  const raw = await getObjects(ids);

  return path.map(leg => {
    const obj = raw[leg.poolId];
    if (!obj) throw new Error(`Pool ${leg.poolId} not found on chain`);

    const balA = parseInt(obj.balance_a, 10) / Math.pow(10, leg.assetA.precision);
    const balB = parseInt(obj.balance_b, 10) / Math.pow(10, leg.assetB.precision);
    const takerFeeBps = parseInt(obj.taker_fee_percent, 10);

    return { poolId: leg.poolId, balA, balB, takerFeeBps };
  });
}

// ── Path computation ─────────────────────────────────────────────────────────

/**
 * Compute the full route for a given input amount.
 *
 * @param {number} inputAmount         — amount of asset to sell (human units)
 * @param {Array}  poolStates          — result of fetchPoolState()
 * @param {number} [slippagePct=0.5]   — acceptable slippage % for min_to_receive
 * @param {boolean} [isReverse=false]  — if true, swap XLM -> XRP
 * @returns {{
 *   inputAmount:  number,
 *   midBts:       number,   // BTS received after leg 1
 *   outputAmount: number,   // target asset received after leg 2
 *   rate:         number,   // output per input (effective rate)
 *   isReverse:    boolean,
 *   legs: Array<{
 *     poolId:       string,
 *     sellSymbol:   string,
 *     buySymbol:    string,
 *     amountIn:     number,
 *     amountOut:    number,
 *     minToReceive: number,
 *     takerFeeBps:  number,
 *     reserveIn:    number,
 *     reserveOut:   number,
 *     priceImpactPct: number,
 *   }>
 * }}
 */
export function computePath(inputAmount, poolStates, slippagePct = 0.5, isReverse = false) {
  const slippageFactor = 1 - slippagePct / 100;
  const path = getPath(isReverse);
  let currentAmount = inputAmount;
  const legs = [];

  for (let i = 0; i < path.length; i++) {
    const leg   = path[i];
    // Find state for this poolId
    const state = poolStates.find(s => s.poolId === leg.poolId);

    const isSellA  = leg.sell === "A";
    const reserveIn  = isSellA ? state.balA : state.balB;
    const reserveOut = isSellA ? state.balB : state.balA;

    // Fee deducted from input before AMM
    const feeMultiplier = 1 - state.takerFeeBps / 10_000;
    const effectiveIn   = currentAmount * feeMultiplier;
    const amountOut     = cpOutput(effectiveIn, reserveIn, reserveOut);
    const minToReceive  = amountOut * slippageFactor;

    // Price impact: how much the trade moves the pool price (%)
    const priceImpactPct = (currentAmount / (reserveIn + currentAmount)) * 100;

    legs.push({
      poolId:         leg.poolId,
      sellSymbol:     leg.sellAsset.symbol,
      buySymbol:      leg.buyAsset.symbol,
      amountIn:       currentAmount,
      amountOut,
      minToReceive,
      takerFeeBps:    state.takerFeeBps,
      reserveIn,
      reserveOut,
      priceImpactPct,
    });

    currentAmount = amountOut;
  }

  const outputAmount = legs[1].amountOut;
  const midBts       = legs[0].amountOut;
  const rate         = outputAmount / inputAmount;

  return { inputAmount, midBts, outputAmount, rate, legs, isReverse };
}

// ── Transaction builder ──────────────────────────────────────────────────────

/**
 * Build a rawbeeteos:// deep-link for the 2-operation swap.
 *
 * Operation type 63 = liquidity_pool_exchange
 *
 * @param {string} accountId   — e.g. "1.2.12345"
 * @param {ReturnType<computePath>} pathResult
 * @returns {string}           — rawbeeteos:// URI ready for Beet wallet
 */
export function buildDeepLink(accountId, pathResult) {
  const { legs, isReverse } = pathResult;
  const path = getPath(isReverse);

  const operations = legs.map((leg, i) => {
    const legDef     = path[i];
    const sellAsset  = legDef.sellAsset;
    const buyAsset   = legDef.buyAsset;
    const sellFactor = Math.pow(10, sellAsset.precision);
    const buyFactor  = Math.pow(10, buyAsset.precision);

    return [
      63,
      {
        fee: { amount: "100000", asset_id: "1.3.0" },
        account: accountId,
        pool: leg.poolId,
        amount_to_sell: {
          amount: String(Math.floor(leg.amountIn  * sellFactor)),
          asset_id: sellAsset.id,
        },
        min_to_receive: {
          amount: String(Math.floor(leg.minToReceive * buyFactor)),
          asset_id: buyAsset.id,
        },
        extensions: [],
      },
    ];
  });

  const now = Date.now();
  const expiration = new Date(now + 24 * 60 * 60 * 1000).toISOString().split(".")[0];

  const txContent = {
    ref_block_num: 0,
    ref_block_prefix: 0,
    expiration,
    operations,
    extensions: [],
    signatures: [],
  };

  const label = isReverse ? "xlm-xrp" : "xrp-xlm";
  const transaction = {
    type: "api",
    id: `${now}-iob-${label}`,
    payload: {
      method: "injectedCall",
      params: ["signAndBroadcast", JSON.stringify(txContent), []],
      appName: `IOB ${label.toUpperCase()} Path`,
      chain: "BTS",
      browser: "web browser",
      origin: window.location.origin,
      memo: false,
    },
  };

  return `rawbeeteos://api?chain=BTS&request=${encodeURIComponent(JSON.stringify(transaction))}`;
}

/**
 * Return the raw transaction JSON (for copy/download).
 *
 * @param {string} accountId
 * @param {ReturnType<computePath>} pathResult
 * @returns {string}  — pretty-printed JSON
 */
export function buildTransactionJSON(accountId, pathResult) {
  const deepLink = buildDeepLink(accountId, pathResult);
  // Extract and re-parse the embedded transaction for clean JSON output
  const url = new URL(deepLink.replace(/^rawbeeteos:\/\//, "https://placeholder/"));
  const tx  = JSON.parse(decodeURIComponent(url.searchParams.get("request")));
  return JSON.stringify(tx, null, 2);
}
