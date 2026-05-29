/**
 * BlockchainBlock Model
 * Each block in the tamper-evident audit chain.
 * SHA-256 links blocks together; any modification breaks the chain.
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IBlockEvent {
  userId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface IBlock extends Document {
  blockNumber: number;
  timestamp: Date;
  events: IBlockEvent[];
  previousHash: string;
  hash: string;
  nonce: number;
}

const blockEventSchema = new Schema<IBlockEvent>(
  {
    userId: { type: String },
    action: { type: String, required: true },
    resource: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false }
);

const blockSchema = new Schema<IBlock>(
  {
    blockNumber: { type: Number, required: true, unique: true, index: true },
    timestamp: { type: Date, required: true },
    events: { type: [blockEventSchema], default: [] },
    previousHash: { type: String, required: true },
    hash: { type: String, required: true, index: true },
    nonce: { type: Number, required: true },
  },
  { timestamps: false, versionKey: false }
);

const BlockchainBlock = mongoose.model<IBlock>('BlockchainBlock', blockSchema);
export default BlockchainBlock;
