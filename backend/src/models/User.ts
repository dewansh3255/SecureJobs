/**
 * User Model
 * Core user schema with authentication fields
 */

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  headline?: string;
  location?: string;
  role: 'user' | 'admin' | 'moderator';
  isVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  refreshToken?: string;
  csrfSecret?: string;
  settings: {
    emailNotifications: boolean;
    profileVisibility: 'public' | 'connections' | 'private';
    darkMode: boolean;
  };
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  connections: mongoose.Types.ObjectId[];
  blockedUsers: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isLocked(): boolean;
  getFullName(): string;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [255, 'Email must be less than 255 characters'],
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [128, 'Password must be less than 128 characters'],
      select: false,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name must be less than 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name must be less than 50 characters'],
    },
    profilePicture: {
      type: String,
      default: null,
    },
    headline: {
      type: String,
      maxlength: [100, 'Headline must be less than 100 characters'],
      default: 'Professional',
    },
    location: {
      type: String,
      maxlength: [100, 'Location must be less than 100 characters'],
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    csrfSecret: {
      type: String,
      select: false,
    },
    settings: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      profileVisibility: {
        type: String,
        enum: ['public', 'connections', 'private'],
        default: 'public',
      },
      darkMode: {
        type: Boolean,
        default: false,
      },
    },
    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    following: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    connections: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
userSchema.index({ firstName: 1, lastName: 1 });
userSchema.index({ location: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for profile URL
userSchema.virtual('profileUrl').get(function () {
  return `/profile/${this._id}`;
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Method to get full name
userSchema.methods.getFullName = function (): string {
  return `${this.firstName} ${this.lastName}`;
};

// Static method to find available users (not locked)
userSchema.statics.findAvailableUsers = function () {
  return this.find({
    isActive: true,
    $or: [
      { lockUntil: { $exists: false } },
      { lockUntil: { $lte: new Date() } },
    ],
  });
};

const User = mongoose.model<IUser>('User', userSchema);

export default User;
