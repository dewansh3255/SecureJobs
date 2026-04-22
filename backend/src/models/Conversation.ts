/**
 * Conversation Model
 * Manages conversation threads between users
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  messageCount: number;
  type: 'direct' | 'group';
  name?: string;
  groupAdmin?: mongoose.Types.ObjectId;
  metadata: {
    mutedBy: mongoose.Types.ObjectId[];
    archivedBy: mongoose.Types.ObjectId[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: {
      type: Date,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    type: {
      type: String,
      enum: ['direct', 'group'],
      default: 'direct',
    },
    name: {
      type: String,
      maxlength: [50, 'Conversation name must be less than 50 characters'],
    },
    groupAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    metadata: {
      mutedBy: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      archivedBy: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ type: 1 });

// Pre-save hook to update lastMessageAt
conversationSchema.pre('save', function (next) {
  if (this.lastMessageAt === undefined) {
    this.lastMessageAt = new Date();
  }
  next();
});

// Method to add participant
conversationSchema.methods.addParticipant = function (userId: mongoose.Types.ObjectId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
  }
};

// Method to remove participant
conversationSchema.methods.removeParticipant = function (userId: mongoose.Types.ObjectId) {
  this.participants = this.participants.filter(
    (p: mongoose.Types.ObjectId) => p.toString() !== userId.toString()
  );
};

// Method to check if user is participant
conversationSchema.methods.isParticipant = function (userId: mongoose.Types.ObjectId): boolean {
  return this.participants.some((p: mongoose.Types.ObjectId) => p.toString() === userId.toString());
};

// Method to mute conversation
conversationSchema.methods.mute = function (userId: mongoose.Types.ObjectId) {
  if (!this.metadata.mutedBy.includes(userId)) {
    this.metadata.mutedBy.push(userId);
  }
};

// Method to unmute conversation
conversationSchema.methods.unmute = function (userId: mongoose.Types.ObjectId) {
  this.metadata.mutedBy = this.metadata.mutedBy.filter(
    (id: mongoose.Types.ObjectId) => id.toString() !== userId.toString()
  );
};

// Method to archive conversation
conversationSchema.methods.archive = function (userId: mongoose.Types.ObjectId) {
  if (!this.metadata.archivedBy.includes(userId)) {
    this.metadata.archivedBy.push(userId);
  }
};

// Method to unarchive conversation
conversationSchema.methods.unarchive = function (userId: mongoose.Types.ObjectId) {
  this.metadata.archivedBy = this.metadata.archivedBy.filter(
    (id: mongoose.Types.ObjectId) => id.toString() !== userId.toString()
  );
};

// Static method to find conversation between two users
conversationSchema.statics.findDirectConversation = function (
  user1: mongoose.Types.ObjectId,
  user2: mongoose.Types.ObjectId
) {
  return this.findOne({
    participants: { $all: [user1, user2] },
    type: 'direct',
  });
};

const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema);

export default Conversation;
