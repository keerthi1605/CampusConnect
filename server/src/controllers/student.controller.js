import StudentProfile from '../models/StudentProfile.js';
import User, { ROLES } from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { pageMeta, toSkip, toSort } from '../utils/pagination.js';

const USER_FIELDS = 'name email';

/* ---------- student: own profile ---------- */

export const getMyProfile = async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user._id });
  // null (not 404) so the client can simply show an empty form on first visit
  res.json({ success: true, profile });
};

export const upsertMyProfile = async (req, res) => {
  const profile =
    (await StudentProfile.findOne({ user: req.user._id })) ||
    new StudentProfile({ user: req.user._id });

  // Full replace: optional fields left out of the request are cleared
  profile.set({ phone: undefined, resumeUrl: undefined, ...req.body });
  await profile.save();

  res.json({ success: true, profile });
};

/* ---------- admin: browse students ---------- */

export const listStudents = async (req, res) => {
  const { q, branch, batchYear, minCgpa, maxCgpa, maxBacklogs, sort, page, limit } = req.query;

  const filter = {};
  if (branch) filter.branch = branch;
  if (batchYear !== undefined) filter.batchYear = batchYear;
  if (minCgpa !== undefined || maxCgpa !== undefined) {
    filter.cgpa = {
      ...(minCgpa !== undefined && { $gte: minCgpa }),
      ...(maxCgpa !== undefined && { $lte: maxCgpa }),
    };
  }
  if (maxBacklogs !== undefined) filter.backlogs = { $lte: maxBacklogs };

  if (q) {
    // Name/email live on User, roll number on the profile: resolve matching users first
    const rx = new RegExp(escapeRegex(q), 'i');
    const userIds = await User.find({
      role: ROLES.STUDENT,
      $or: [{ name: rx }, { email: rx }],
    }).distinct('_id');
    filter.$or = [{ rollNo: rx }, { user: { $in: userIds } }];
  }

  const [total, students] = await Promise.all([
    StudentProfile.countDocuments(filter),
    StudentProfile.find(filter)
      .populate('user', USER_FIELDS)
      .sort(toSort(sort))
      .skip(toSkip({ page, limit }))
      .limit(limit),
  ]);

  res.json({ success: true, data: students, pagination: pageMeta({ page, limit }, total) });
};

export const getStudent = async (req, res) => {
  const profile = await StudentProfile.findById(req.params.id).populate('user', USER_FIELDS);
  if (!profile) throw ApiError.notFound('Student profile not found');

  res.json({ success: true, profile });
};
