import mongoose from 'mongoose';
import { BRANCHES } from '../constants/branches.js';

const studentProfileSchema = new mongoose.Schema(
  {
    // One profile per user account
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    rollNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    branch: { type: String, required: true, enum: BRANCHES, index: true },
    cgpa: { type: Number, required: true, min: 0, max: 10, index: true },
    batchYear: { type: Number, required: true, min: 2000, max: 2100, index: true },
    backlogs: { type: Number, default: 0, min: 0 },
    phone: { type: String, match: /^\d{10}$/ },
    skills: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] },
    resumeUrl: { type: String, trim: true, maxlength: 500 },
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

export default mongoose.model('StudentProfile', studentProfileSchema);
