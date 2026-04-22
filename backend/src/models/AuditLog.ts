/**
 * AuditLog Model
 * Persists every security event to MongoDB for forensic analysis.
 * Auto-expires entries after 90 days (TTL index) to manage storage.
 */

import mongoose, { Document, Schema } from 'mongoose';

export type AuditSeverity = 'info' | 'warn' | 'error';
export type AuditAction =
  | 'login_success'
  | 'login_failure'
  | 'login_2fa_success'
  | 'login_2fa_failure'
  | 'logout'
  | 'register'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_success'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'account_locked'
  | 'token_refresh'
  | 'csrf_violation'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'admin_action'
  | 'profile_updated'
  | 'photo_uploaded'
  | string; // allow extensibility

export interface IAuditLog extends Document {
  event: string;
  action: AuditAction;
  severity: AuditSeverity;
  userId?: mongoose.Types.ObjectId;
  ip?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    event: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    severity: { type: String, enum: ['info', 'warn', 'error'], default: 'info', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ip: { type: String },
    userAgent: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

// TTL: auto-delete entries older than 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound index for efficient dashboard queries
auditLogSchema.index({ severity: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
