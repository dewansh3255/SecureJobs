/**
 * Blockchain Audit Service
 * Tamper-evident audit log backed by a simple SHA-256 blockchain.
 *
 * Design:
 *  - Genesis block: blockNumber=0, previousHash=64 zeros, events=[]
 *  - Mining difficulty: 1 leading zero (fast, for demo purposes)
 *  - Batching: flush every 30 events OR every 60 seconds
 *  - Verification: re-compute every block hash and check previousHash links
 */

import crypto from 'crypto';
import BlockchainBlock, { IBlockEvent } from '../models/BlockchainBlock';

const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
const MAX_PENDING_EVENTS = 30;
const FLUSH_INTERVAL_MS = 60_000;

let pendingEvents: IBlockEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/* ─── Core hash computation ─────────────────────────────────────────────── */

function computeHash(
  blockNumber: number,
  timestamp: Date,
  events: IBlockEvent[],
  previousHash: string,
  nonce: number
): string {
  const data = `${blockNumber}${timestamp.toISOString()}${JSON.stringify(events)}${previousHash}${nonce}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/* ─── Mining (1 leading zero = easy difficulty) ─────────────────────────── */

async function mineBlock(
  blockNumber: number,
  timestamp: Date,
  events: IBlockEvent[],
  previousHash: string
): Promise<{ hash: string; nonce: number }> {
  let nonce = 0;
  let hash = '';
  do {
    hash = computeHash(blockNumber, timestamp, events, previousHash, nonce);
    nonce++;
    // Yield to event loop every 1000 iterations to keep server responsive
    if (nonce % 1000 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  } while (!hash.startsWith('0'));
  return { hash, nonce: nonce - 1 };
}

/* ─── Flush pending events into a new block ─────────────────────────────── */

async function flushPending(): Promise<void> {
  if (pendingEvents.length === 0) return;

  const events = [...pendingEvents];
  pendingEvents = [];

  try {
    const latestBlock = await BlockchainBlock.findOne().sort({ blockNumber: -1 }).lean();
    const blockNumber = (latestBlock?.blockNumber ?? -1) + 1;
    const previousHash = latestBlock?.hash ?? GENESIS_PREV_HASH;
    const timestamp = new Date();

    const { hash, nonce } = await mineBlock(blockNumber, timestamp, events, previousHash);

    await BlockchainBlock.create({ blockNumber, timestamp, events, previousHash, hash, nonce });
    console.info(`[Blockchain] Mined block #${blockNumber} — ${events.length} events, nonce=${nonce}, hash=${hash.slice(0, 16)}…`);
  } catch (err) {
    console.error('[Blockchain] Failed to mine block:', err);
    // Put events back at the front so they're retried next flush
    pendingEvents = [...events, ...pendingEvents];
  }
}

function startFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushPending().catch((err) => console.error('[Blockchain] Scheduled flush error:', err));
  }, FLUSH_INTERVAL_MS);
  // Allow Node.js to exit even if the timer is active
  if (flushTimer.unref) flushTimer.unref();
}

/* ─── Public API ────────────────────────────────────────────────────────── */

/**
 * Add an audit event to the pending pool.
 * Automatically flushes when MAX_PENDING_EVENTS is reached.
 */
export async function addAuditEvent(event: IBlockEvent): Promise<void> {
  pendingEvents.push(event);
  if (pendingEvents.length >= MAX_PENDING_EVENTS) {
    await flushPending();
  }
}

/**
 * Verify the entire chain integrity:
 * - re-compute each block's hash
 * - verify previousHash links
 */
export async function verifyChain(): Promise<{
  valid: boolean;
  brokenAt?: number;
  totalBlocks: number;
}> {
  const blocks = await BlockchainBlock.find().sort({ blockNumber: 1 }).lean();

  if (blocks.length === 0) {
    return { valid: true, totalBlocks: 0 };
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const recomputed = computeHash(
      b.blockNumber,
      new Date(b.timestamp),
      b.events as IBlockEvent[],
      b.previousHash,
      b.nonce
    );

    if (recomputed !== b.hash) {
      return { valid: false, brokenAt: b.blockNumber, totalBlocks: blocks.length };
    }

    if (i > 0 && b.previousHash !== blocks[i - 1].hash) {
      return { valid: false, brokenAt: b.blockNumber, totalBlocks: blocks.length };
    }
  }

  return { valid: true, totalBlocks: blocks.length };
}

/**
 * Initialize the genesis block if the chain is empty.
 * Must be called once after the database is connected.
 */
export async function initGenesis(): Promise<void> {
  const exists = await BlockchainBlock.findOne({ blockNumber: 0 }).lean();
  if (exists) {
    console.info('[Blockchain] Genesis block already exists — chain ready');
    startFlushTimer();
    return;
  }

  const timestamp = new Date();
  const events: IBlockEvent[] = [];
  const blockNumber = 0;

  const { hash, nonce } = await mineBlock(blockNumber, timestamp, events, GENESIS_PREV_HASH);

  await BlockchainBlock.create({
    blockNumber,
    timestamp,
    events,
    previousHash: GENESIS_PREV_HASH,
    hash,
    nonce,
  });

  console.info(`[Blockchain] Genesis block created — hash=${hash.slice(0, 16)}…, nonce=${nonce}`);
  startFlushTimer();
}
