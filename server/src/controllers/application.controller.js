import Application from '../models/Application.js';
import Job from '../models/Job.js';
import StudentProfile from '../models/StudentProfile.js';
import {
  ADMIN_TRANSITIONS,
  APPLICATION_STATUS,
  WITHDRAWABLE,
} from '../constants/applicationStatus.js';
import ApiError from '../utils/ApiError.js';
import { checkEligibility } from '../utils/eligibility.js';
import { pageMeta, toSkip, toSort } from '../utils/pagination.js';

const JOB_FIELDS = 'title company type location ctc deadline status';
const PROFILE_FIELDS = 'rollNo branch cgpa batchYear backlogs phone skills resumeUrl';

const historyEntry = (status, userId, remark) => ({
  status,
  changedBy: userId,
  at: new Date(),
  ...(remark && { remark }),
});

/* ---------- student ---------- */

export const applyToJob = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');

  const profile = await StudentProfile.findOne({ user: req.user._id });

  // Re-checked on the server: the eligible flag on the job list is only a hint
  const { eligible, reasons } = checkEligibility(profile?.toObject(), job.toObject());
  if (!eligible) {
    throw new ApiError(
      403,
      'You are not eligible for this job',
      reasons.map((message) => ({ field: 'eligibility', message }))
    );
  }

  try {
    const application = await Application.create({
      student: req.user._id,
      job: job._id,
      profile: profile._id,
      statusHistory: [historyEntry(APPLICATION_STATUS.APPLIED, req.user._id)],
    });
    res.status(201).json({ success: true, application });
  } catch (err) {
    // The unique {student, job} index is what really prevents duplicates, even
    // when two requests race past each other
    if (err.code === 11000) throw ApiError.conflict('You have already applied to this job');
    throw err;
  }
};

export const listMyApplications = async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = { student: req.user._id, ...(status && { status }) };

  const [total, data] = await Promise.all([
    Application.countDocuments(filter),
    Application.find(filter)
      .populate('job', JOB_FIELDS)
      .sort(toSort('-createdAt'))
      .skip(toSkip({ page, limit }))
      .limit(limit),
  ]);

  res.json({ success: true, data, pagination: pageMeta({ page, limit }, total) });
};

export const withdrawApplication = async (req, res) => {
  const { id } = req.params;

  // Single atomic step: only succeeds if it is still the caller's and still undecided
  const application = await Application.findOneAndUpdate(
    { _id: id, student: req.user._id, status: { $in: WITHDRAWABLE } },
    {
      $set: { status: APPLICATION_STATUS.WITHDRAWN },
      $push: { statusHistory: historyEntry(APPLICATION_STATUS.WITHDRAWN, req.user._id) },
    },
    { new: true }
  );

  if (!application) {
    // Not found vs. already decided: someone else's application looks the same as a missing one
    const existing = await Application.findOne({ _id: id, student: req.user._id }).select('status');
    if (!existing) throw ApiError.notFound('Application not found');
    throw ApiError.conflict(`Cannot withdraw an application that is already ${existing.status}`);
  }

  res.json({ success: true, application });
};

/* ---------- admin ---------- */

export const listJobApplications = async (req, res) => {
  const { status, page, limit } = req.query;

  if (!(await Job.exists({ _id: req.params.id }))) throw ApiError.notFound('Job not found');

  const filter = { job: req.params.id, ...(status && { status }) };

  const [total, data] = await Promise.all([
    Application.countDocuments(filter),
    Application.find(filter)
      .populate('student', 'name email')
      .populate('profile', PROFILE_FIELDS)
      .sort(toSort('-createdAt'))
      .skip(toSkip({ page, limit }))
      .limit(limit),
  ]);

  res.json({ success: true, data, pagination: pageMeta({ page, limit }, total) });
};

export const updateApplicationStatus = async (req, res) => {
  const { status, remark } = req.body;

  const current = await Application.findById(req.params.id);
  if (!current) throw ApiError.notFound('Application not found');

  const allowed = ADMIN_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(status)) {
    const next = allowed.length ? `allowed next: ${allowed.join(', ')}` : 'no further changes allowed';
    throw ApiError.conflict(`Cannot move an application from ${current.status} to ${status} (${next})`);
  }

  // Conditional on the status we just validated against: if a withdrawal or another
  // admin got in first, this matches nothing instead of overwriting their change
  const application = await Application.findOneAndUpdate(
    { _id: current._id, status: current.status },
    {
      $set: { status },
      $push: { statusHistory: historyEntry(status, req.user._id, remark) },
    },
    { new: true }
  );
  if (!application) {
    throw ApiError.conflict('This application was just changed by someone else; reload and try again');
  }

  res.json({ success: true, application });
};
