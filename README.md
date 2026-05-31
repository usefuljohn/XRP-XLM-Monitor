# BitShares Pool Explorer: XRP & XLM

A real-time liquidity pool monitor for XRP and XLM pairs on the BitShares DEX. This tool provides insights into pool health, yield opportunities, and trading volume.

## 🚀 Getting Started

There are two ways to use this application:

### 1. Standalone Version (Quick Start)
Open `index.html` directly in any web browser. 
- **No installation required.**
- **Zero dependencies.**
- **Portable**: Perfect for quick checks or sharing with others.

### 2. React Version (For Developers)
The project is built with React and TypeScript for a more robust, feature-rich experience.
- Ensure you have [Node.js](https://nodejs.org/) installed.
- Run `npm install` to install dependencies.
- Run `npm run dev` to start the development server.

## 📊 Interpreting the Data

The monitor displays several key metrics for each liquidity pool:

*   **TVL (Total Value Locked)**: The total value of assets currently held in the pool. We calculate this as `2 × balance of the native asset` (XRP or XLM), assuming the pool is balanced.
*   **APY (Annual Percentage Yield)**: An estimate of the yearly returns for liquidity providers based on the last 24 hours of trading fees.
*   **24h Volume**: The total amount of trading activity in the pool over the last 24 hours.
*   **Price Ratio**: Shows the current exchange rate between the two assets in the pool.

## ⚙️ Configuration

You can customize the monitor by editing `config.ts`:

*   **Nodes**: Update the `BITSHARES_NODES` array to add or prioritize different API endpoints.
*   **Pools**: Add new pool IDs to `IOXRP_POOL_IDS` or `IOXLM_POOL_IDS` to track additional liquidity pairs.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Created by [usefuljohn](https://github.com/usefuljohn).
