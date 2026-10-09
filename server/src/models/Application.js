import mongoose from 'mongoose';
import { APPLICATION_STATUS } from '../constants/applicationStatus.js';

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(APPLICATION_STATUS), required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
    remark: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentProfile', required: true },
    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.APPLIED,
    },
    statusHistory: { type: [historySchema], default: [] },
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

// One application per student per job, enforced by the database (race-proof)
applicationSchema.index({ student: 1, job: 1 }, { unique: true });
// Admin applicant lists: by job, optionally by status
applicationSchema.index({ job: 1, status: 1, createdAt: -1 });
// Student "my applications"
applicationSchema.index({ student: 1, createdAt: -1 });

export default mongoose.model('Application', applicationSchema);
