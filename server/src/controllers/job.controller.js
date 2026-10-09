import Application from '../models/Application.js';
import Job from '../models/Job.js';
import StudentProfile from '../models/StudentProfile.js';
import ApiError from '../utils/ApiError.js';
import { checkEligibility } from '../utils/eligibility.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { pageMeta, toSkip, toSort } from '../utils/pagination.js';
import { ROLES } from '../models/User.js';

/** Attaches { eligible, reasons } to each job for a student caller; leaves admin jobs as-is. */
async function annotateForRole(jobs, req) {
  if (req.user.role !== ROLES.STUDENT) return jobs;
  const profile = await StudentProfile.findOne({ user: req.user._id }).lean();
  return jobs.map((job) => ({ ...job, ...checkEligibility(profile, job) }));
}

const buildFilter = ({ q, type, status }) => {
  const and = [];
  if (type) and.push({ type });

  if (status === 'open') {
    and.push({ status: 'open' }, { deadline: { $gte: new Date() } });
  } else if (status === 'closed') {
    and.push({ $or: [{ status: 'closed' }, { deadline: { $lt: new Date() } }] });
  } // 'all' adds no status/deadline condition

  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    and.push({ $or: [{ title: rx }, { company: rx }] });
  }

  return and.length ? { $and: and } : {};
};

export const listJobs = async (req, res) => {
  const { q, type, status, sort, page, limit } = req.query;
  const filter = buildFilter({ q, type, status });

  const [total, jobs] = await Promise.all([
    Job.countDocuments(filter),
    Job.find(filter)
      .populate('createdBy', 'name')
      .sort(toSort(sort))
      .skip(toSkip({ page, limit }))
      .limit(limit),
  ]);

  const data = await annotateForRole(
    jobs.map((j) => j.toJSON()),
    req
  );

  res.json({ success: true, data, pagination: pageMeta({ page, limit }, total) });
};

export const getJob = async (req, res) => {
  const job = await Job.findById(req.params.id).populate('createdBy', 'name');
  if (!job) throw ApiError.notFound('Job not found');

  const [annotated] = await annotateForRole([job.toJSON()], req);
  res.json({ success: true, job: annotated });
};

export const createJob = async (req, res) => {
  const job = await Job.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, job });
};

export const updateJob = async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');

  // Partial merge: top-level fields overwrite, eligibility fields merge into the
  // existing sub-document so e.g. { status: 'closed' } alone doesn't wipe minCgpa etc.
  const { eligibility, ...rest } = req.body;
  Object.assign(job, rest);
  if (eligibility) Object.assign(job.eligibility, eligibility);

  await job.save();
  res.json({ success: true, job });
};

export const deleteJob = async (req, res) => {
  if (await Application.exists({ job: req.params.id })) {
    // Deleting would orphan applications and erase students' history; closing keeps both
    throw ApiError.conflict('This job has applications and cannot be deleted. Close it instead.');
  }

  const job = await Job.findByIdAndDelete(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');
  res.json({ success: true, message: 'Job deleted' });
};
