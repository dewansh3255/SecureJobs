/**
 * Message Model
 * Private messages between users with encryption support
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  recipients: Array<{
    user: mongoose.Types.ObjectId;
    readAt?: Date;
  }>;
  content: string;
  encrypted: boolean;
  attachments?: Array<{
    type: 'image' | 'file';
    url: string;
    name: string;
    size: number;
  }>;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipients: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        readAt: {
          type: Date,
        },
      },
    ],
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [5000, 'Message content must be less than 5000 characters'],
    },
    encrypted: {
      type: Boolean,
      default: true,
    },
    attachments: [
      {
        type: {
          type: String,
          enum: ['image', 'file'],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

// Virtual for checking if all recipients have read
messageSchema.virtual('isFullyRead').get(function () {
  return this.recipients.every((r) => r.readAt !== undefined);
});

// Method to mark as read
messageSchema.methods.markAsRead = function (userId: mongoose.Types.ObjectId) {
  const recipient = this.recipients.find(
    (r: { user: mongoose.Types.ObjectId; readAt?: Date }) => r.user.toString() === userId.toString()
  );
  if (recipient) {
    recipient.readAt = new Date();
  }
};

// Method to check if read by user
messageSchema.methods.isReadBy = function (userId: mongoose.Types.ObjectId): boolean {
  const recipient = this.recipients.find(
    (r: { user: mongoose.Types.ObjectId; readAt?: Date }) => r.user.toString() === userId.toString()
  );
  return recipient?.readAt !== undefined;
};

// Soft delete
messageSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
};

const Message = mongoose.model<IMessage>('Message', messageSchema);

export default Message;
