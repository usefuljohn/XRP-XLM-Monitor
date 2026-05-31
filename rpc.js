/**
 * rpc.js — Minimal BitShares WebSocket RPC client
 *
 * No dependencies. Uses the browser's native WebSocket API.
 * Handles node rotation, request/response correlation, and object caching.
 */

export const NODES = [
  "wss://dex.iobanker.com/ws",
  "wss://api.bts.mobi",
  "wss://api.61bts.com/ws",
  "wss://api-us.61bts.com/wss",
  "wss://eu.nodes.bitshares.ws",
  "wss://api.dex.trading",
  "wss://cloud.xbts.io/ws",
  "wss://btsws.roelandp.nl/ws",
  "wss://public.xbts.io/ws",
  "wss://node.xbts.io/ws",
  "wss://api.btslebin.com/ws",
];

/** Fisher-Yates shuffle — returns a new array */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let _ws = null;
let _msgId = 1;
let _heartbeatTimer = null;
const _pending = new Map();   // id → { resolve, reject, timer }
const _cache   = new Map();   // objectId → object

/**
 * Connect to the first responsive BitShares node.
 * @param {(status: string, detail?: string) => void} onStatus
 * @returns {Promise<WebSocket>}
 */
export async function connect(onStatus) {
  const nodes = shuffle(NODES);
  for (const node of nodes) {
    onStatus?.("connecting", node);
    try {
      const ws = await _tryConnect(node);
      _ws = ws;
      onStatus?.("connected", node);
      _startHeartbeat();
      return ws;
    } catch {
      // try next
    }
  }
  throw new Error("Could not connect to any BitShares node.");
}

function _startHeartbeat() {
  stopHeartbeat();
  _heartbeatTimer = setInterval(async () => {
    try {
      if (isConnected()) {
        await call(["database", "get_objects", [["2.1.0"]]]);
      }
    } catch {
      // ignore
    }
  }, 20_000);
}

export function stopHeartbeat() {
  if (_heartbeatTimer) clearInterval(_heartbeatTimer);
  _heartbeatTimer = null;
}

function _tryConnect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); reject(new Error("timeout")); }, 5000);

    ws.onopen = () => {
      clearTimeout(timer);
      ws.onmessage = _onMessage;
      ws.onclose   = () => { _ws = null; stopHeartbeat(); };
      ws.onerror   = () => { _ws = null; stopHeartbeat(); };
      resolve(ws);
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error(`error connecting to ${url}`)); };
  });
}

function _onMessage(event) {
  let data;
  try { data = JSON.parse(event.data); } catch { return; }
  const entry = _pending.get(data.id);
  if (!entry) return;
  clearTimeout(entry.timer);
  _pending.delete(data.id);
  if (data.error) entry.reject(new Error(data.error.message || "RPC error"));
  else            entry.resolve(data.result);
}

/**
 * Send a raw RPC call over the current WebSocket.
 * @param {unknown[]} params  — [api, method, args]
 * @returns {Promise<unknown>}
 */
export function call(params) {
  return new Promise((resolve, reject) => {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) {
      reject(new Error("WebSocket not connected")); return;
    }
    const id = _msgId++;
    const timer = setTimeout(() => {
      _pending.delete(id);
      reject(new Error("RPC request timed out"));
    }, 30_000);
    _pending.set(id, { resolve, reject, timer });
    _ws.send(JSON.stringify({ method: "call", params, jsonrpc: "2.0", id }));
  });
}

/**
 * Fetch one or more objects by ID, with in-memory caching.
 * @param {string[]} ids
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getObjects(ids) {
  const result  = {};
  const missing = [];
  for (const id of ids) {
    if (_cache.has(id)) result[id] = _cache.get(id);
    else missing.push(id);
  }
  if (missing.length === 0) return result;

  const raw = await call(["database", "get_objects", [missing]]);
  if (Array.isArray(raw)) {
    raw.forEach((obj, i) => {
      if (obj) {
        _cache.set(missing[i], obj);
        result[missing[i]] = obj;
      }
    });
  }
  return result;
}

/**
 * Lookup an account by ID and return its name.
 * @param {string} accountId
 * @returns {Promise<string>}
 */
export async function lookupAccount(accountId) {
  const objects = await getObjects([accountId]);
  const account = objects[accountId];
  if (!account) throw new Error("Account not found");
  return account.name;
}

/** True if the WebSocket is currently open. */
export function isConnected() {
  return _ws !== null && _ws.readyState === WebSocket.OPEN;
}

/** Close the current connection and clear pending requests. */
export function disconnect() {
  _ws?.close();
  _ws = null;
  for (const { reject, timer } of _pending.values()) {
    clearTimeout(timer);
    reject(new Error("Disconnected"));
  }
  _pending.clear();
}
