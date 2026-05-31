/**
 * app.js — Application controller
 *
 * Wires the DOM to the RPC client and path engine.
 * No framework, no build step — runs directly in the browser via ES modules.
 */

import { connect, isConnected, lookupAccount }            from "./rpc.js";
import { ASSETS, getPath, fetchPoolState, computePath, buildDeepLink, buildTransactionJSON } from "./path.js";

// ── DOM refs ──────────────────────────────────────────────────────────────

const $connStatus     = document.getElementById("conn-status");
const $btnConnect     = document.getElementById("btn-connect");
const $btnRefresh     = document.getElementById("btn-refresh");
const $btnToggle      = document.getElementById("btn-toggle-dir");

const $amountInput    = document.getElementById("amount-input");
const $labelAmount    = document.getElementById("label-amount");
const $slippageInput  = document.getElementById("slippage-input");
const $accountInput   = document.getElementById("account-input");
const $accountVerify  = document.getElementById("account-verify");

const $iconSell       = document.getElementById("icon-sell");
const $symbolSell     = document.getElementById("symbol-sell");
const $iconBuy        = document.getElementById("icon-buy");
const $symbolBuy      = document.getElementById("symbol-buy");
const $tagPool1       = document.getElementById("tag-pool-1");
const $tagPool2       = document.getElementById("tag-pool-2");

const $resultsSection = document.getElementById("results-section");
const $resSell        = document.getElementById("res-sell");
const $resMid         = document.getElementById("res-mid");
const $resReceive     = document.getElementById("res-receive");
const $resRate        = document.getElementById("res-rate");
const $legsBody       = document.getElementById("legs-body");
const $reservesBody   = document.getElementById("reserves-body");

const $txSection      = document.getElementById("tx-section");
const $txJsonPreview  = document.getElementById("tx-json-preview");
const $btnDeeplink    = document.getElementById("btn-deeplink");
const $btnCopyJson    = document.getElementById("btn-copy-json");
const $btnDownloadJson= document.getElementById("btn-download-json");
const $btnCopyDeeplink= document.getElementById("btn-copy-deeplink");

const $logOutput      = document.getElementById("log-output");

// ── State ─────────────────────────────────────────────────────────────────

let _poolStates   = null;   // last fetched pool states
let _pathResult   = null;   // last computed path result
let _isReverse    = false;  // false: XRP->XLM, true: XLM->XRP
let _refreshTimer = null;

// ── Logging ───────────────────────────────────────────────────────────────

function log(msg, type = "info") {
  const line = document.createElement("div");
  line.className = `log-line ${type}`;
  const ts = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="log-time">${ts}</span>${escHtml(msg)}`;
  $logOutput.appendChild(line);
  $logOutput.scrollTop = $logOutput.scrollHeight;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Connection ────────────────────────────────────────────────────────────

async function doConnect() {
  $btnConnect.disabled = true;
  setStatus("connecting", "Connecting…");
  log("Connecting to BitShares node…");

  try {
    await connect((status, detail) => {
      setStatus(status, detail);
      if (detail) log(detail, status === "connected" ? "success" : "info");
    });
    $btnRefresh.disabled = false;
    log("Connected. Fetching live pool data…", "success");
    await doRefresh();
    startAutoRefresh();
  } catch (err) {
    setStatus("error", "Connection failed");
    log(`Connection failed: ${err.message}`, "error");
    $btnConnect.disabled = false;
  }
}

function setStatus(status, detail) {
  $connStatus.className = `status-badge ${status}`;
  const labels = {
    disconnected: "Disconnected",
    connecting:   "Connecting…",
    connected:    "Connected",
    error:        "Error",
  };
  $connStatus.textContent = detail
    ? `${labels[status] ?? status}: ${detail}`
    : (labels[status] ?? status);
}

// ── Refresh (fetch + compute) ─────────────────────────────────────────────

async function doRefresh() {
  if (!isConnected()) {
    log("Not connected — please connect first.", "warning");
    return;
  }

  $btnRefresh.disabled = true;
  log("Fetching live pool balances…");

  try {
    _poolStates = await fetchPoolState();
  } catch (err) {
    log(`Failed to fetch pool state: ${err.message}`, "error");
    $btnRefresh.disabled = false;
    return;
  }

  computeAndRender();
  $btnRefresh.disabled = false;
}

function startAutoRefresh() {
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(() => {
    if (isConnected()) doRefresh();
  }, 15_000);
}

// ── Toggle Direction ──────────────────────────────────────────────────────

function toggleDirection() {
  _isReverse = !_isReverse;
  const sellAsset = _isReverse ? ASSETS.IOB_XLM : ASSETS.IOB_XRP;
  const buyAsset  = _isReverse ? ASSETS.IOB_XRP : ASSETS.IOB_XLM;
  const path      = getPath(_isReverse);

  // Update UI labels
  $labelAmount.textContent = `Amount to sell (${sellAsset.symbol})`;
  $symbolSell.textContent  = sellAsset.symbol;
  $symbolBuy.textContent   = buyAsset.symbol;
  $iconSell.className      = `asset-icon ${sellAsset.icon}`;
  $iconSell.textContent    = sellAsset.symbol.charAt(sellAsset.symbol.length - 1);
  $iconBuy.className       = `asset-icon ${buyAsset.icon}`;
  $iconBuy.textContent     = buyAsset.symbol.charAt(buyAsset.symbol.length - 1);

  $tagPool1.textContent    = `Pool ${path[0].poolId}`;
  $tagPool2.textContent    = `Pool ${path[1].poolId}`;

  log(`Switched direction to ${sellAsset.symbol} → ${buyAsset.symbol}`);
  if (_poolStates) computeAndRender();
}

// ── Compute & render ──────────────────────────────────────────────────────

function computeAndRender() {
  if (!_poolStates) return;

  const amount   = parseFloat($amountInput.value)   || 0;
  const slippage = parseFloat($slippageInput.value) || 0.5;

  if (amount <= 0) {
    $resultsSection.classList.add("hidden");
    return;
  }

  try {
    _pathResult = computePath(amount, _poolStates, slippage, _isReverse);
  } catch (err) {
    log(`Computation error: ${err.message}`, "error");
    return;
  }

  const { inputAmount, midBts, outputAmount, rate, legs } = _pathResult;
  const sellAsset = _isReverse ? ASSETS.IOB_XLM : ASSETS.IOB_XRP;
  const buyAsset  = _isReverse ? ASSETS.IOB_XRP : ASSETS.IOB_XLM;

  // Summary
  $resSell.textContent    = `${fmt(inputAmount, 4)} ${sellAsset.symbol}`;
  $resMid.textContent     = `${fmt(midBts,   5)} BTS`;
  $resReceive.textContent = `${fmt(outputAmount, 4)} ${buyAsset.symbol}`;
  $resRate.textContent    = `${fmt(rate, 6)} ${buyAsset.symbol.split(".")[1]}/${sellAsset.symbol.split(".")[1]}`;
  $resRate.className      = "s-value success";

  // Legs table
  $legsBody.innerHTML = legs.map((leg, i) => `
    <tr>
      <td>Leg ${i + 1}</td>
      <td><code>${leg.poolId}</code></td>
      <td>${escHtml(leg.sellSymbol)}</td>
      <td>${escHtml(leg.buySymbol)}</td>
      <td>${fmt(leg.amountIn, 6)}</td>
      <td>${fmt(leg.amountOut, 6)}</td>
      <td>${fmt(leg.minToReceive, 6)}</td>
      <td>${leg.takerFeeBps}</td>
      <td class="${leg.priceImpactPct > 1 ? "warn" : ""}">${leg.priceImpactPct.toFixed(3)}%</td>
    </tr>
  `).join("");

  // Reserves table
  const path = getPath(_isReverse);
  $reservesBody.innerHTML = _poolStates.map((state, i) => {
      // Find the leg definition that matches this pool state
      const legDef = path.find(l => l.poolId === state.poolId) || path[i];
      return `
        <tr>
          <td><code>${state.poolId}</code></td>
          <td>${escHtml(legDef.assetA.symbol)}</td>
          <td>${fmt(state.balA, legDef.assetA.precision)}</td>
          <td>${escHtml(legDef.assetB.symbol)}</td>
          <td>${fmt(state.balB, legDef.assetB.precision)}</td>
        </tr>
      `;
  }).join("");

  $resultsSection.classList.remove("hidden");

  // Transaction section
  const accountId = $accountInput.value.trim();
  if (accountId && /^1\.2\.\d+$/.test(accountId)) {
    renderTransaction(accountId);
  } else {
    $txSection.classList.add("hidden");
  }
}

async function verifyAccount() {
  const id = $accountInput.value.trim();
  if (!id || !/^1\.2\.\d+$/.test(id)) {
    $accountVerify.classList.add("hidden");
    return;
  }

  $accountVerify.textContent = "Verifying…";
  $accountVerify.className = "account-name-badge loading";
  $accountVerify.classList.remove("hidden");

  try {
    const name = await lookupAccount(id);
    $accountVerify.textContent = `✓ ${name}`;
    $accountVerify.className = "account-name-badge success";
    localStorage.setItem("iob_account_id", id);
    if (_pathResult) renderTransaction(id);
  } catch (err) {
    $accountVerify.textContent = "⚠ Account not found";
    $accountVerify.className = "account-name-badge error";
    $txSection.classList.add("hidden");
  }
}

function renderTransaction(accountId) {
  if (!_pathResult) return;
  try {
    const json = buildTransactionJSON(accountId, _pathResult);
    $txJsonPreview.textContent = json;
    $txSection.classList.remove("hidden");
  } catch (err) {
    log(`Transaction build error: ${err.message}`, "error");
  }
}

// ── Number formatting ─────────────────────────────────────────────────────

function fmt(n, precision = 4) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
}

// ── Copy Feedback ─────────────────────────────────────────────────────────

function showCopyFeedback(btn) {
  const originalText = btn.textContent;
  btn.textContent = "Copied!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = originalText;
    btn.classList.remove("copied");
  }, 2000);
}

// ── Event listeners ───────────────────────────────────────────────────────

$btnConnect.addEventListener("click", doConnect);
$btnRefresh.addEventListener("click", doRefresh);
$btnToggle.addEventListener("click", toggleDirection);

// Re-compute whenever inputs change (no network call needed)
[$amountInput, $slippageInput].forEach(el => {
  el.addEventListener("input", () => { if (_poolStates) computeAndRender(); });
});

let _verifyTimeout = null;
$accountInput.addEventListener("input", () => {
  if (_verifyTimeout) clearTimeout(_verifyTimeout);
  _verifyTimeout = setTimeout(verifyAccount, 500);
});

// Transaction buttons
$btnDeeplink.addEventListener("click", () => {
  const accountId = $accountInput.value.trim();
  if (!_pathResult || !accountId) return;
  try {
    const link = buildDeepLink(accountId, _pathResult);
    window.location.href = link;
    log("Opened deep link in Beet wallet.", "success");
  } catch (err) {
    log(`Deep link error: ${err.message}`, "error");
  }
});

$btnCopyJson.addEventListener("click", async () => {
  const text = $txJsonPreview.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showCopyFeedback($btnCopyJson);
    log("Transaction JSON copied to clipboard.", "success");
  } catch {
    log("Clipboard write failed — please copy manually.", "warning");
  }
});

$btnDownloadJson.addEventListener("click", () => {
  const text = $txJsonPreview.textContent;
  if (!text) return;
  const blob = new Blob([text], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  const label = _isReverse ? "xlm-xrp" : "xrp-xlm";
  a.download = `iob-${label}-tx-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  log("Transaction JSON downloaded.", "success");
});

$btnCopyDeeplink.addEventListener("click", async () => {
  const accountId = $accountInput.value.trim();
  if (!_pathResult || !accountId) return;
  try {
    const link = buildDeepLink(accountId, _pathResult);
    await navigator.clipboard.writeText(link);
    showCopyFeedback($btnCopyDeeplink);
    log("Deep link copied to clipboard.", "success");
  } catch {
    log("Clipboard write failed.", "warning");
  }
});

// ── Initialize ────────────────────────────────────────────────────────────

const savedAccount = localStorage.getItem("iob_account_id");
if (savedAccount) {
  $accountInput.value = savedAccount;
  // Account verification requires a connection, so we'll wait until connected.
}

log("IOB.XRP ⇄ IOB.XLM path tool loaded. Click 'Connect to Node' to begin.");
