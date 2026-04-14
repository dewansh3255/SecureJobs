/**
 * Connection Model
 * Manages user connections and connection requests
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IConnection extends Document {
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const connectionSchema = new Schema<IConnection>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
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
connectionSchema.index({ sender: 1, receiver: 1, status: 1 });
connectionSchema.index({ receiver: 1, sender: 1, status: 1 });

// Prevent self-connection
connectionSchema.pre('save', function (next) {
  if (this.sender.toString() === this.receiver.toString()) {
    throw new Error('Cannot send connection request to yourself');
  }
  next();
});

// Static method to find connection between two users
connectionSchema.statics.findConnection = function (user1: mongoose.Types.ObjectId, user2: mongoose.Types.ObjectId) {
  return this.findOne({
    $or: [
      { sender: user1, receiver: user2 },
      { sender: user2, receiver: user1 },
    ],
  }).sort({ updatedAt: -1 });
};

// Static method to find pending requests for a user
connectionSchema.statics.findPendingRequests = function (userId: mongoose.Types.ObjectId) {
  return this.find({
    receiver: userId,
    status: 'pending',
  }).populate('sender', 'firstName lastName headline profilePicture');
};

// Static method to find accepted connections
connectionSchema.statics.findAcceptedConnections = function (userId: mongoose.Types.ObjectId) {
  return this.find({
    $or: [
      { sender: userId, status: 'accepted' },
      { receiver: userId, status: 'accepted' },
    ],
  }).populate('sender', 'firstName lastName headline profilePicture')
    .populate('receiver', 'firstName lastName headline profilePicture');
};

const Connection = mongoose.model<IConnection>('Connection', connectionSchema);

export default Connection;
