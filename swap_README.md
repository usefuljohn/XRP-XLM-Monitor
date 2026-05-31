# IOB.XRP ⇄ IOB.XLM Path

A lean, **dependency-free** single-page tool for computing and executing swaps
between `IOB.XRP` and `IOB.XLM` on the BitShares DEX via their shared BTS
liquidity pools.

## Route

The tool supports bi-directional swaps via a 1-hop path:

**Forward:** `IOB.XRP ──► BTS ──► IOB.XLM`  
**Reverse:** `IOB.XLM ──► BTS ──► IOB.XRP`

| Leg | Pool ID   | Asset A | Asset B  |
|-----|-----------|---------|----------|
| 1   | 1.19.133  | BTS     | IOB.XRP  |
| 2   | 1.19.399  | BTS     | IOB.XLM  |

## Features

- **Bi-directional Swaps** — Toggle between XRP→XLM and XLM→XRP.
- **Auto-Refresh** — Live pool balances update automatically every 15 seconds.
- **Account Verification** — Resolves and displays the Account Name for any
  valid BitShares Account ID.
- **Persistent Settings** — Remembers your Account ID across sessions using
  local storage.
- **Zero runtime dependencies** — Pure HTML + CSS + vanilla ES modules.
- **Live pool data** — Fetches reserves and fees directly from BitShares nodes.
- **Constant-product AMM** — Accurate output calculation matching on-chain
  logic.
- **Price impact display** — Highlights trades with >1% price impact.
- **Transaction output** — Generates `rawbeeteos://` deep links for the
  [Beet](https://github.com/bitshares/beet) wallet and raw JSON payloads.
- **Node rotation & Heartbeat** — Automatically rotates nodes and maintains
  active WebSocket connections.

## Usage

### Development Server Required

**Important:** Because this application uses vanilla ES Modules, you **cannot** open `index.html` directly from your file system (the `file://` protocol). Modern browsers will block the script from loading due to security (CORS) restrictions.

You must serve the directory with a static file server:

```bash
# Option 1: Node.js (npx, no install required)
npx serve .

# Option 2: Python 3
python -m http.server 8000

# Option 3: VS Code
# Install the "Live Server" extension and click "Go Live"
```

Then navigate to the provided local URL (e.g., `http://localhost:3000` or `http://localhost:8000`).

### Workflow

1. Click **Connect to Node** — the tool connects to the fastest available
   BitShares API node and immediately fetches live pool balances.
2. Enter the **amount of IOB.XRP** you want to sell.
3. Adjust the **slippage tolerance** if needed (default 0.5 %).
4. The path analysis updates instantly — no additional network call required
   after the initial pool fetch.
5. To generate a transaction, enter your **BitShares account ID** (e.g.
   `1.2.12345`).
6. Use **Open in Beet** to sign and broadcast, or **Copy / Download JSON** to
   inspect the raw transaction.

## File Structure

```
iob-xrp-xlm-path/
├── index.html          # Single-page UI — no framework
├── app.js              # DOM controller — wires UI to rpc + path
├── path.js             # AMM math, pool constants, transaction builder
├── rpc.js              # WebSocket RPC client (connect, getObjects)
└── style.css           # Dark-theme stylesheet
```

## Technical Notes

### AMM formula

The constant-product formula used is:

```
dy = (y · dx_eff) / (x + dx_eff)
```

where `dx_eff = dx · (1 − fee/10000)` — the fee is deducted from the input
**before** the AMM, matching the BitShares on-chain implementation.

### Transaction structure

Each leg produces one `liquidity_pool_exchange` operation (type `63`):

```json
[63, {
  "fee": { "amount": "100000", "asset_id": "1.3.0" },
  "account": "<account_id>",
  "pool": "<pool_id>",
  "amount_to_sell":  { "amount": "<int>", "asset_id": "<sell_asset>" },
  "min_to_receive":  { "amount": "<int>", "asset_id": "<buy_asset>"  },
  "extensions": []
}]
```

Amounts are converted to integer chain units by multiplying by
`10^precision` and flooring.

### Deep link format

```
rawbeeteos://api?chain=BTS&request=<URL-encoded JSON transaction>
```

## Relationship to path-finder-pro

This tool is a purpose-built extraction of the IOB.XRP → IOB.XLM route from
the generic [path-finder-pro](https://github.com/usefuljohn/path-finder-pro)
application. The original repository is left entirely unchanged.

Key differences:

| Aspect | path-finder-pro | This tool |
|--------|----------------|-----------|
| Framework | React + Zustand + shadcn/ui | None |
| Build system | Vite + TypeScript | None |
| Dependencies | ~40 npm packages | 0 |
| Path scope | Generic N-hop routing | Fixed 2-leg IOB.XRP→BTS→IOB.XLM |
| Pool loading | Remote cache (all pools) | Direct `get_objects` on 2 pool IDs |
| Graph algorithm | Dijkstra-like BFS | Not needed (path is hardcoded) |

## License

MIT
