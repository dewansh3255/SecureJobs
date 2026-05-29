/**
 * Company Model
 * Company pages on the platform — admins/recruiters can create and manage companies
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface ICompanyMember {
  user: mongoose.Types.ObjectId;
  role: 'admin' | 'recruiter';
  addedAt: Date;
}

export interface ICompany extends Document {
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  location?: string;
  logo?: string;
  coverImage?: string;
  size?: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001-5000' | '5001+';
  founded?: number;
  admin: mongoose.Types.ObjectId;
  members: ICompanyMember[];
  followers: mongoose.Types.ObjectId[];
  specialties: string[];
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters'],
      maxlength: [100, 'Company name must be less than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description must be less than 5000 characters'],
    },
    industry: {
      type: String,
      trim: true,
      maxlength: [100, 'Industry must be less than 100 characters'],
    },
    website: {
      type: String,
      trim: true,
      maxlength: [200, 'Website must be less than 200 characters'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [100, 'Location must be less than 100 characters'],
    },
    logo: {
      type: String,
    },
    coverImage: {
      type: String,
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'],
    },
    founded: {
      type: Number,
      min: [1800, 'Founded year must be after 1800'],
      max: [new Date().getFullYear(), 'Founded year cannot be in the future'],
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Company admin is required'],
      index: true,
    },
    members: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        role: {
          type: String,
          enum: ['admin', 'recruiter'],
          default: 'recruiter',
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    specialties: {
      type: [String],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ name: 'text', description: 'text', industry: 'text' });
companySchema.index({ industry: 1 });
companySchema.index({ location: 1 });

const Company = mongoose.model<ICompany>('Company', companySchema);

export default Company;
