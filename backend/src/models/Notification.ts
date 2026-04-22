/**
 * Notification Model
 * User notifications for various platform events
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: 'connection_request' | 'connection_accepted' | 'message' | 'post_reaction' |
        'comment' | 'comment_reaction' | 'job_application' | 'job_posted' |
        'mention' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  reference?: mongoose.Types.ObjectId;
  referenceModel?: string;
  read: boolean;
  readAt?: Date;
  actionUrl?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reference: {
      type: Schema.Types.ObjectId,
    },
    referenceModel: {
      type: String,
    },
    type: {
      type: String,
      enum: [
        'connection_request',
        'connection_accepted',
        'message',
        'post_reaction',
        'comment',
        'comment_reaction',
        'job_application',
        'job_posted',
        'mention',
        'system',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: [100, 'Title must be less than 100 characters'],
    },
    message: {
      type: String,
      required: true,
      maxlength: [500, 'Message must be less than 500 characters'],
    },
    data: {
      type: Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    actionUrl: {
      type: String,
    },
    icon: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// Auto-expire old notifications (TTL index - 30 days)
notificationSchema.index({ createdAt: 1 }, {
  expireAfterSeconds: 30 * 24 * 60 * 60,
  partialFilterExpression: { read: true }
});

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = function (userId: mongoose.Types.ObjectId) {
  return this.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function (userId: mongoose.Types.ObjectId) {
  return this.countDocuments({ recipient: userId, read: false });
};

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
