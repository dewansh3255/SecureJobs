/**
 * Application Model
 * Job applications submitted by users
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IApplication extends Document {
  job: mongoose.Types.ObjectId;
  applicant: mongoose.Types.ObjectId;
  employer: mongoose.Types.ObjectId;
  status: 'pending' | 'reviewed' | 'interviewing' | 'offered' | 'accepted' | 'rejected' | 'withdrawn';
  coverLetter?: string;
  notes?: string;
  /** E2EE resume — encrypted by applicant's browser for the employer's ECDH public key */
  resumeCiphertext?: string;   // base64 AES-256-GCM ciphertext
  resumeIv?: string;           // base64 12-byte AES-GCM IV
  resumeOriginalName?: string; // original filename (e.g. "cv.pdf")
  resumeMimeType?: string;     // original MIME type
  /** Applicant's ECDH public key JWK — employer uses this to derive the shared AES key */
  applicantPublicKey?: string; // JSON-serialised JWK
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy?: mongoose.Types.ObjectId;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    applicant: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'interviewing', 'offered', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true,
    },
    resumeCiphertext: { type: String },      // base64 AES-GCM ciphertext (E2EE for employer)
    resumeIv: { type: String },              // base64 IV
    resumeOriginalName: { type: String },    // original filename
    resumeMimeType: { type: String },        // original MIME type
    applicantPublicKey: { type: String },    // JSON JWK (employer uses to derive shared key)
    coverLetter: {
      type: String,
      maxlength: [5000, 'Cover letter must be less than 5000 characters'],
    },
    notes: {
      type: String,
      maxlength: [2000, 'Notes must be less than 2000 characters'],
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for unique application per job per user
applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
applicationSchema.index({ applicant: 1, status: 1 });
applicationSchema.index({ employer: 1, status: 1 });

// Pre-save hook to update status history
applicationSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
    });
  }
  next();
});

// Method to update status
applicationSchema.methods.updateStatus = function (
  newStatus: IApplication['status'],
  changedBy?: mongoose.Types.ObjectId
) {
  this.status = newStatus;
  if (changedBy) {
    const lastEntry = this.statusHistory[this.statusHistory.length - 1];
    if (lastEntry) {
      lastEntry.changedBy = changedBy;
    }
  }
};

// Method to withdraw application
applicationSchema.methods.withdraw = function () {
  this.status = 'withdrawn';
};

const Application = mongoose.model<IApplication>('Application', applicationSchema);

export default Application;
