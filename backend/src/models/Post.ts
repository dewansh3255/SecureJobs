/**
 * Post Model
 * User posts for the news feed
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  author: mongoose.Types.ObjectId;
  content: string;
  imageUrl?: string;
  documentUrl?: string;
  reactions: {
    like: mongoose.Types.ObjectId[];
    celebrate: mongoose.Types.ObjectId[];
    support: mongoose.Types.ObjectId[];
    love: mongoose.Types.ObjectId[];
    insightful: mongoose.Types.ObjectId[];
    curious: mongoose.Types.ObjectId[];
  };
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  savedBy: mongoose.Types.ObjectId[];
  visibility: 'public' | 'connections' | 'private';
  isEdited: boolean;
  originalPost?: mongoose.Types.ObjectId;
  sharedFrom?: mongoose.Types.ObjectId;
  tags: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  addReaction(userId: mongoose.Types.ObjectId, type: string): void;
  removeReaction(userId: mongoose.Types.ObjectId): void;
  getTotalReactions(): number;
  incrementCommentCount(): void;
  decrementCommentCount(): void;
  incrementShareCount(): void;
}

const postSchema = new Schema<IPost>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      minlength: [1, 'Post content must be at least 1 character'],
      maxlength: [5000, 'Post content must be less than 5000 characters'],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    documentUrl: {
      type: String,
      default: null,
    },
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
    commentCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    savedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    visibility: {
      type: String,
      enum: ['public', 'connections', 'private'],
      default: 'public',
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    originalPost: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    sharedFrom: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    tags: {
      type: [String],
      default: [],
      validate: { validator: (arr: string[]) => arr.length <= 50, message: 'Too many tags (max 50)' },
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
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ tags: 1 });

// Virtual for checking if user has reacted
postSchema.virtual('hasReacted').get(function () {
  // This would be populated at query time
  return false;
});

// Method to add reaction
postSchema.methods.addReaction = function (userId: mongoose.Types.ObjectId, type: string) {
  const validTypes = ['like', 'celebrate', 'support', 'love', 'insightful', 'curious'];
  if (!validTypes.includes(type)) {
    throw new Error('Invalid reaction type');
  }

  // Remove any existing reaction from this user
  this.removeReaction(userId);

  // Add new reaction
  (this.reactions[type as keyof typeof this.reactions] as mongoose.Types.ObjectId[]).push(userId);
  this.reactionCount = this.getTotalReactions();
  this.isEdited = false; // Reset edited flag for reactions
};

// Method to remove reaction
postSchema.methods.removeReaction = function (userId: mongoose.Types.ObjectId) {
  const reactionTypes = Object.keys(this.reactions) as Array<keyof typeof this.reactions>;
  reactionTypes.forEach((type) => {
    this.reactions[type] = (this.reactions[type] as mongoose.Types.ObjectId[]).filter(
      (id) => id.toString() !== userId.toString()
    );
  });
  this.reactionCount = this.getTotalReactions();
};

// Helper to get total reactions
postSchema.methods.getTotalReactions = function () {
  return Object.values(this.reactions).reduce((total: number, arr: unknown) => total + (arr as mongoose.Types.ObjectId[]).length, 0);
};

// Method to increment comment count
postSchema.methods.incrementCommentCount = function () {
  this.commentCount += 1;
};

// Method to decrement comment count
postSchema.methods.decrementCommentCount = function () {
  this.commentCount = Math.max(0, this.commentCount - 1);
};

// Method to increment share count
postSchema.methods.incrementShareCount = function () {
  this.shareCount += 1;
};

const Post = mongoose.model<IPost>('Post', postSchema);

export default Post;
