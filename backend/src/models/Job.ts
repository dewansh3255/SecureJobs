/**
 * Job Model
 * Job postings on the platform
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IJob extends Document {
  employer: mongoose.Types.ObjectId;
  title: string;
  company: string;
  companyRef?: mongoose.Types.ObjectId;
  description: string;
  requirements: string[];
  responsibilities?: string[];
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'internship' | 'remote';
  salary?: {
    min: number;
    max: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  applicationDeadline?: Date;
  applicationCount: number;
  status: 'active' | 'closed' | 'draft';
  skills: string[];
  benefits?: string[];
  remote: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    employer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      minlength: [3, 'Job title must be at least 3 characters'],
      maxlength: [100, 'Job title must be less than 100 characters'],
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters'],
      maxlength: [100, 'Company name must be less than 100 characters'],
    },
    companyRef: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
      minlength: [50, 'Job description must be at least 50 characters'],
      maxlength: [10000, 'Job description must be less than 10000 characters'],
    },
    requirements: {
      type: [String],
      required: true,
    },
    responsibilities: {
      type: [String],
    },
    location: {
      type: String,
      required: [true, 'Job location is required'],
      trim: true,
      maxlength: [100, 'Location must be less than 100 characters'],
    },
    type: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
      required: [true, 'Job type is required'],
    },
    salary: {
      min: {
        type: Number,
      },
      max: {
        type: Number,
      },
      currency: {
        type: String,
        default: 'USD',
      },
      period: {
        type: String,
        enum: ['hourly', 'monthly', 'yearly'],
        default: 'yearly',
      },
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'lead', 'executive'],
      required: [true, 'Experience level is required'],
    },
    applicationDeadline: {
      type: Date,
    },
    applicationCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'draft'],
      default: 'active',
      index: true,
    },
    skills: {
      type: [String],
      trim: true,
    },
    benefits: {
      type: [String],
    },
    remote: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance and search
jobSchema.index({ employer: 1, createdAt: -1 });
jobSchema.index({ type: 1, status: 1 });
jobSchema.index({ location: 1, status: 1 });
jobSchema.index({ experienceLevel: 1, status: 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ title: 'text', description: 'text', skills: 'text' });

// Method to increment application count
jobSchema.methods.incrementApplicationCount = function () {
  this.applicationCount += 1;
};

// Method to close job
jobSchema.methods.close = function () {
  this.status = 'closed';
};

// Static method to find active jobs
jobSchema.statics.findActiveJobs = function () {
  return this.find({ status: 'active' });
};

// Static method to search jobs
jobSchema.statics.searchJobs = function (query: string) {
  return this.find({
    $text: { $search: query },
    status: 'active',
  });
};

const Job = mongoose.model<IJob>('Job', jobSchema);

export default Job;
