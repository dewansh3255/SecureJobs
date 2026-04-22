/**
 * Connection Model
 * Manages user connections and connection requests
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IConnection extends Document {
  requester: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const connectionSchema = new Schema<IConnection>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    message: {
      type: String,
      maxlength: [300, 'Connection message must be less than 300 characters'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
connectionSchema.index({ requester: 1, recipient: 1, status: 1 });
connectionSchema.index({ recipient: 1, requester: 1, status: 1 });

// Prevent self-connection
connectionSchema.pre('save', function (next) {
  if (this.requester.toString() === this.recipient.toString()) {
    throw new Error('Cannot send connection request to yourself');
  }
  next();
});

// Static method to find connection between two users
connectionSchema.statics.findConnection = function (user1: mongoose.Types.ObjectId, user2: mongoose.Types.ObjectId) {
  return this.findOne({
    $or: [
      { requester: user1, recipient: user2 },
      { requester: user2, recipient: user1 },
    ],
  }).sort({ updatedAt: -1 });
};

// Static method to find pending requests for a user
connectionSchema.statics.findPendingRequests = function (userId: mongoose.Types.ObjectId) {
  return this.find({
    recipient: userId,
    status: 'pending',
  }).populate('requester', 'firstName lastName headline profilePicture');
};

// Static method to find accepted connections
connectionSchema.statics.findAcceptedConnections = function (userId: mongoose.Types.ObjectId) {
  return this.find({
    $or: [
      { requester: userId, status: 'accepted' },
      { recipient: userId, status: 'accepted' },
    ],
  }).populate('requester', 'firstName lastName headline profilePicture')
    .populate('recipient', 'firstName lastName headline profilePicture');
};

const Connection = mongoose.model<IConnection>('Connection', connectionSchema);

export default Connection;
