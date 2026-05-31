# BitShares Pool Explorer ⇄ IOB Swap Tool

A unified, dependency-free dashboard for monitoring and executing XRP/XLM swaps on the BitShares DEX. This tool combines real-time liquidity pool monitoring with a purpose-built 1-hop swap path calculator.

## 🚀 Getting Started

### Development Server Required
**Important:** Because the Swap Tool uses vanilla ES Modules, you **cannot** open `index.html` directly from your file system. You must serve the `iob` directory with a static file server:

```bash
# Option 1: Node.js (npx)
npx serve .

# Option 2: Python 3
python -m http.server 8000
```

Then navigate to `http://localhost:3000` or `http://localhost:8000`.

---

## 📊 Feature 1: The Monitor (Landing Page)
The landing page provides a high-level overview of XRP and XLM liquidity pools.

*   **Live Metrics**: TVL, APY, 24h Volume, and current Price Ratios.
*   **Asset Tabs**: Quickly switch between XRP and XLM pool sets.
*   **Health Tracking**: Visual indicators for connection status and data freshness.
*   **Interpret Data**: TVL is calculated as `2 × balance of the native asset`, providing a standard benchmark for pool depth.

## ⇄ Feature 2: The Swap Tool (Beet Integration)
Once you've identified a trading opportunity in the monitor, enter **Swap Mode** to execute the trade.

*   **1-Hop Path**: Automatically computes the optimal route via BTS (`XRP → BTS → XLM` or `XLM → BTS → XRP`).
*   **Live AMM Math**: Real-time output calculations with price impact and slippage protection.
*   **Beet Wallet Integration**: Generates `rawbeeteos://` deep links for secure signing.
*   **Account Verification**: Instantly resolves BitShares Account IDs to names.

---

## 🛠 Workflow: From Monitor to Swap

1.  **Analyze**: Review the **XRP Pools** or **XLM Pools** tabs to check current liquidity and price ratios.
2.  **Enter Swap Mode**: Click the **"Swap Mode ⇄"** button in the header or the **"Swap Tool"** tab.
3.  **Configure**:
    *   Choose your direction (XRP→XLM or XLM→XRP).
    *   Enter the amount and slippage tolerance.
4.  **Connect**: Click **"Connect to Node"** (the swap tool maintains a specialized connection for transaction building).
5.  **Sign**: Enter your **Account ID**, verify the name, and click **"Open in Beet"** to broadcast your swap to the blockchain.

## 📜 Technical Notes
- **Zero Runtime Dependencies**: Pure HTML/CSS/JS.
- **WebSocket RPC**: Communicates directly with BitShares nodes.
- **Scoped Styles**: Swap tool styles are isolated to prevent interference with the monitor UI.

## 📜 License
MIT License. Created by [usefuljohn](https://github.com/usefuljohn).
