/**
 * User Model
 * Core user schema with authentication fields
 */

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password?: string;
  googleId?: string;
  authProvider: 'local' | 'google';
  firstName: string;
  lastName: string;
  profilePicture?: string;
  coverImage?: string;
  headline?: string;
  about?: string;
  location?: string;
  phone?: string;
  website?: string;
  industry?: string;
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    from: Date;
    to?: Date;
    current: boolean;
    description?: string;
  }>;
  education: Array<{
    school: string;
    degree: string;
    field: string;
    from: Date;
    to?: Date;
    current: boolean;
    description?: string;
  }>;
  role: 'user' | 'admin' | 'moderator';
  /** Account type controls feature access: recruiters can post jobs */
  accountType: 'candidate' | 'recruiter';
  isVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  refreshToken?: string;
  csrfSecret?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  twoFactorBackupCodes?: string[];
  twoFactorSetupExpiry?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  settings: {
    emailNotifications: boolean;
    profileVisibility: 'public' | 'connections' | 'private';
    darkMode: boolean;
  };
  privacySettings: {
    email: 'public' | 'connections' | 'private';
    phone: 'public' | 'connections' | 'private';
    headline: 'public' | 'connections' | 'private';
    about: 'public' | 'connections' | 'private';
    experience: 'public' | 'connections' | 'private';
    education: 'public' | 'connections' | 'private';
    skills: 'public' | 'connections' | 'private';
    connections: 'public' | 'connections' | 'private';
    resume: 'public' | 'connections' | 'private';
  };
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  connections: mongoose.Types.ObjectId[];
  blockedUsers: mongoose.Types.ObjectId[];
  lastSeen?: Date;
  notificationPreferences: {
    email: {
      connectionRequest: boolean;
      connectionAccepted: boolean;
      newMessage: boolean;
      postReaction: boolean;
      postComment: boolean;
      jobApplication: boolean;
      jobStatusUpdate: boolean;
    };
    push: {
      connectionRequest: boolean;
      newMessage: boolean;
      postReaction: boolean;
      postComment: boolean;
    };
  };
  /** ECDH P-256 public key (JWK JSON string) for E2E message encryption */
  publicKey?: string;
  /** Zero-knowledge encrypted resume — encrypted entirely in the browser.
   *  The server stores only ciphertext; it CANNOT decrypt the file. */
  resume?: {
    encryptedPath: string;   // path to ciphertext file on disk
    originalName: string;    // original filename shown to user
    mimeType: string;        // application/pdf or application/vnd.openxmlformats-officedocument.wordprocessingml.document
    salt: string;            // PBKDF2 salt — hex (browser-generated, NOT secret)
    iv: string;              // AES-GCM IV — hex (browser-generated)
    uploadedAt: Date;
  };
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
      required: false,          // optional — OAuth users have no password
      minlength: [8, 'Password must be at least 8 characters'],
      maxlength: [128, 'Password must be less than 128 characters'],
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
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
    coverImage: {
      type: String,
      default: null,
    },
    headline: {
      type: String,
      maxlength: [100, 'Headline must be less than 100 characters'],
      default: 'Professional',
    },
    about: {
      type: String,
      maxlength: [2600, 'About must be less than 2600 characters'],
      default: '',
    },
    location: {
      type: String,
      maxlength: [100, 'Location must be less than 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone must be less than 20 characters'],
      sparse: true,
      index: true,
    },
    website: {
      type: String,
      maxlength: [200, 'Website must be less than 200 characters'],
    },
    industry: {
      type: String,
      maxlength: [100, 'Industry must be less than 100 characters'],
    },
    skills: {
      type: [String],
      default: [],
      validate: { validator: (arr: string[]) => arr.length <= 50, message: 'Too many skills (max 50)' },
    },
    experience: [
      {
        title: { type: String, required: true, maxlength: 100 },
        company: { type: String, required: true, maxlength: 100 },
        location: { type: String, maxlength: 100 },
        from: { type: Date, required: true },
        to: { type: Date },
        current: { type: Boolean, default: false },
        description: { type: String, maxlength: 2000 },
      },
    ],
    education: [
      {
        school: { type: String, required: true, maxlength: 100 },
        degree: { type: String, required: true, maxlength: 100 },
        field: { type: String, required: true, maxlength: 100 },
        from: { type: Date, required: true },
        to: { type: Date },
        current: { type: Boolean, default: false },
        description: { type: String, maxlength: 2000 },
      },
    ],
    role: {
      type: String,
      enum: ['user', 'admin', 'moderator'],
      default: 'user',
    },
    accountType: {
      type: String,
      enum: ['candidate', 'recruiter'],
      default: 'candidate',
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
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorBackupCodes: {
      type: [String],
      select: false,
    },
    twoFactorSetupExpiry: {
      type: Date,
      select: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
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
    lastSeen: {
      type: Date,
      default: null,
    },
    notificationPreferences: {
      email: {
        connectionRequest: { type: Boolean, default: true },
        connectionAccepted: { type: Boolean, default: true },
        newMessage: { type: Boolean, default: true },
        postReaction: { type: Boolean, default: false },
        postComment: { type: Boolean, default: true },
        jobApplication: { type: Boolean, default: true },
        jobStatusUpdate: { type: Boolean, default: true },
      },
      push: {
        connectionRequest: { type: Boolean, default: true },
        newMessage: { type: Boolean, default: true },
        postReaction: { type: Boolean, default: true },
        postComment: { type: Boolean, default: true },
      },
    },
    privacySettings: {
      email:       { type: String, enum: ['public', 'connections', 'private'], default: 'private' },
      phone:       { type: String, enum: ['public', 'connections', 'private'], default: 'private' },
      headline:    { type: String, enum: ['public', 'connections', 'private'], default: 'public' },
      about:       { type: String, enum: ['public', 'connections', 'private'], default: 'public' },
      experience:  { type: String, enum: ['public', 'connections', 'private'], default: 'public' },
      education:   { type: String, enum: ['public', 'connections', 'private'], default: 'public' },
      skills:      { type: String, enum: ['public', 'connections', 'private'], default: 'public' },
      connections: { type: String, enum: ['public', 'connections', 'private'], default: 'connections' },
      resume:      { type: String, enum: ['public', 'connections', 'private'], default: 'private' },
    },
    publicKey: {
      type: String,
      select: false, // not returned by default — must be explicitly requested
    },
    resume: {
      encryptedPath: { type: String },
      originalName: { type: String },
      mimeType: { type: String },
      salt: { type: String },   // PBKDF2 salt (browser-generated, hex)
      iv: { type: String },     // AES-GCM IV (browser-generated, hex)
      uploadedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        // Strip the entire resume field if no file has been uploaded yet
        // (Mongoose creates the subdocument with default values even when empty)
        if (ret.resume && !ret.resume.originalName) {
          delete ret.resume;
        } else if (ret.resume) {
          // Strip server-only fields — salt, iv, encryptedPath stay server-side for download
          const r = ret.resume as Record<string, unknown>;
          delete r['encryptedPath'];
          delete r['salt'];
          delete r['iv'];
        }
        return ret;
      },
    },
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
  if (!this.password || !this.isModified('password')) return next();

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
