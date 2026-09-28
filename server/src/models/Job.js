import mongoose from 'mongoose';
import { BRANCHES } from '../constants/branches.js';
import { JOB_TYPES } from '../constants/jobTypes.js';

const eligibilitySchema = new mongoose.Schema(
  {
    minCgpa: { type: Number, min: 0, max: 10, default: 0 },
    // Empty list = open to every branch
    branches: { type: [{ type: String, enum: BRANCHES }], default: [] },
    // undefined = no cap / any batch
    maxBacklogs: { type: Number, min: 0 },
    batchYear: { type: Number, min: 2000, max: 2100 },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
    company: { type: String, required: true, trim: true, minlength: 2, maxlength: 150, index: true },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
    location: { type: String, trim: true, maxlength: 150 },
    type: { type: String, enum: JOB_TYPES, required: true, index: true },
    ctc: { type: Number, min: 0 }, // annual CTC in LPA, or stipend for internships
    deadline: { type: Date, required: true, index: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    eligibility: { type: eligibilitySchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model('Job', jobSchema);
