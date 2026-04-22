/**
 * Comment Model
 * Comments on posts with threading support
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IComment extends Document {
  post: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  parentComment?: mongoose.Types.ObjectId;
  replies: mongoose.Types.ObjectId[];
  reactions: {
    like: mongoose.Types.ObjectId[];
    celebrate: mongoose.Types.ObjectId[];
    support: mongoose.Types.ObjectId[];
    love: mongoose.Types.ObjectId[];
    insightful: mongoose.Types.ObjectId[];
    curious: mongoose.Types.ObjectId[];
  };
  reactionCount: number;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment content must be at least 1 character'],
      maxlength: [1000, 'Comment content must be less than 1000 characters'],
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Comment',
      },
    ],
    reactions: {
      like: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      celebrate: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      support: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      love: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      insightful: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      curious: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
    },
    reactionCount: {
      type: Number,
      default: 0,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });

// Method to add reaction
commentSchema.methods.addReaction = function (userId: mongoose.Types.ObjectId, type: string) {
  const validTypes = ['like', 'celebrate', 'support', 'love', 'insightful', 'curious'];
  if (!validTypes.includes(type)) {
    throw new Error('Invalid reaction type');
  }

  // Remove any existing reaction from this user
  this.removeReaction(userId);

  // Add new reaction
  (this.reactions[type as keyof typeof this.reactions] as mongoose.Types.ObjectId[]).push(userId);
  this.reactionCount = this.getTotalReactions();
};

// Method to remove reaction
commentSchema.methods.removeReaction = function (userId: mongoose.Types.ObjectId) {
  const reactionTypes = Object.keys(this.reactions) as Array<keyof typeof this.reactions>;
  reactionTypes.forEach((type) => {
    this.reactions[type] = (this.reactions[type] as mongoose.Types.ObjectId[]).filter(
      (id) => id.toString() !== userId.toString()
    );
  });
  this.reactionCount = this.getTotalReactions();
};

// Helper to get total reactions
commentSchema.methods.getTotalReactions = function () {
  return Object.values(this.reactions).reduce((total: number, arr: unknown) => total + (arr as mongoose.Types.ObjectId[]).length, 0);
};

const Comment = mongoose.model<IComment>('Comment', commentSchema);

export default Comment;
