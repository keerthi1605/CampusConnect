import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import StudentProfile from '../models/StudentProfile.js';
import User, { ROLES } from '../models/User.js';
import { checkEligibility } from '../utils/eligibility.js';

/**
 * Fills the database with realistic demo data for screenshots and walkthroughs:
 * 1 admin, 8 students with profiles, 7 jobs and a spread of applications.
 *
 *   DEMO_PASSWORD=... npm run seed:demo            seed (does nothing if already seeded)
 *   DEMO_PASSWORD=... npm run seed:demo -- --reset  wipe the demo data, then seed again
 *
 * Every demo account uses an @campusconnect.test address and the password you supply, which is
 * never stored in the repository. Refuses to run when NODE_ENV=production.
 */
const DOMAIN = '@campusconnect.test';
const ADMIN_EMAIL = `demo.admin${DOMAIN}`;
const day = 86_400_000;
const daysFromNow = (n) => new Date(Date.now() + n * day);

const STUDENTS = [
  ['Aarav Mehta', { rollNo: '22CS101', branch: 'CSE', cgpa: 9.2, batchYear: 2026, backlogs: 0, skills: ['React', 'Node.js', 'MongoDB'] }],
  ['Diya Nair', { rollNo: '22CS117', branch: 'CSE', cgpa: 8.4, batchYear: 2026, backlogs: 0, skills: ['Java', 'Spring', 'SQL'] }],
  ['Kabir Shah', { rollNo: '22IT042', branch: 'IT', cgpa: 7.6, batchYear: 2026, backlogs: 1, skills: ['Python', 'Django'] }],
  ['Meera Iyer', { rollNo: '22AI009', branch: 'AIML', cgpa: 8.9, batchYear: 2026, backlogs: 0, skills: ['Python', 'PyTorch', 'Pandas'] }],
  ['Rohan Das', { rollNo: '22EC066', branch: 'ECE', cgpa: 7.1, batchYear: 2026, backlogs: 0, skills: ['Embedded C', 'VHDL'] }],
  ['Sara Khan', { rollNo: '21CS088', branch: 'CSE', cgpa: 6.8, batchYear: 2025, backlogs: 2, skills: ['C++', 'DSA'] }],
  ['Tanvi Rao', { rollNo: '22ME021', branch: 'MECH', cgpa: 7.9, batchYear: 2026, backlogs: 0, skills: ['CAD', 'MATLAB'] }],
  ['Vikram Singh', { rollNo: '22CS150', branch: 'CSE', cgpa: 5.9, batchYear: 2026, backlogs: 3, skills: ['HTML', 'CSS'] }],
];

// [title, company, type, location, ctc, deadline in days, eligibility, status]
const JOBS = [
  ['Software Engineer', 'Northwind Systems', 'full-time', 'Bengaluru', 12, 21, { minCgpa: 7.5, branches: ['CSE', 'IT', 'AIML'], maxBacklogs: 0, batchYear: 2026 }],
  ['Data Science Intern', 'Lumen Analytics', 'internship', 'Remote', 6, 14, { minCgpa: 8, branches: ['CSE', 'AIML', 'IT'], batchYear: 2026 }],
  ['Embedded Systems Engineer', 'Voltaic Devices', 'full-time', 'Pune', 8.5, 18, { minCgpa: 6.5, branches: ['ECE', 'EEE'], maxBacklogs: 1 }],
  ['Graduate Trainee', 'Meridian Group', 'full-time', 'Mumbai', 5, 30, { minCgpa: 6, maxBacklogs: 2 }],
  ['Web Developer', 'Brightpath Studio', 'part-time', 'Hyderabad', 4, 9, {}],
  ['Design Engineer', 'Ironwood Mechanical', 'full-time', 'Chennai', 6.5, 25, { minCgpa: 7, branches: ['MECH'] }],
  ['Backend Developer', 'Harbor Pay', 'full-time', 'Bengaluru', 14, 7, { minCgpa: 8, branches: ['CSE', 'IT'], maxBacklogs: 0 }],
];

// [student index, job index, status path after "applied"]
const APPLICATIONS = [
  [0, 0, ['shortlisted', 'interview', 'selected']],
  [0, 1, ['shortlisted']],
  [1, 0, ['shortlisted', 'interview']],
  [1, 3, []],
  [2, 3, ['rejected']],
  [2, 4, []],
  [3, 1, ['shortlisted', 'interview']],
  [3, 0, ['rejected']],
  [4, 2, ['shortlisted', 'interview', 'selected']],
  [4, 3, []],
  [5, 3, ['shortlisted']],
  [6, 5, []],
  [6, 3, ['withdrawn']],
  [7, 4, []],
];

const REMARKS = {
  shortlisted: 'Profile matches the role well.',
  interview: 'Interview scheduled with the hiring team.',
  selected: 'Offer extended.',
  rejected: 'Not moving forward at this stage.',
};

async function resetDemoData() {
  const users = await User.find({ email: { $regex: `${DOMAIN.replace('.', '\\.')}$` } }).select('_id');
  const userIds = users.map((u) => u._id);
  const jobIds = await Job.find({ createdBy: { $in: userIds } }).distinct('_id');
  const apps = await Application.deleteMany({ $or: [{ student: { $in: userIds } }, { job: { $in: jobIds } }] });
  const jobs = await Job.deleteMany({ _id: { $in: jobIds } });
  const profiles = await StudentProfile.deleteMany({ user: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });
  console.log(`Removed ${userIds.length} users, ${profiles.deletedCount} profiles, ${jobs.deletedCount} jobs, ${apps.deletedCount} applications.`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data when NODE_ENV=production');

  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Set DEMO_PASSWORD (8-72 characters with a letter and a number) before running the demo seed');
  }

  await connectDB();

  if (process.argv.includes('--reset')) await resetDemoData();
  else if (await User.exists({ email: ADMIN_EMAIL })) {
    console.log('Demo data already exists. Run with --reset to rebuild it.');
    return;
  }

  const passwordHash = await User.hashPassword(password);
  const admin = await User.create({ name: 'Demo Placement Officer', email: ADMIN_EMAIL, role: ROLES.ADMIN, passwordHash });

  const students = [];
  for (const [name, profile] of STUDENTS) {
    const email = `${name.split(' ')[0].toLowerCase()}${DOMAIN}`;
    const user = await User.create({ name, email, passwordHash });
    const doc = await StudentProfile.create({ user: user._id, phone: '9876500000', ...profile });
    students.push({ user, profile: doc });
  }

  const jobs = [];
  for (const [title, company, type, location, ctc, days, eligibility] of JOBS) {
    jobs.push(
      await Job.create({
        title,
        company,
        type,
        location,
        ctc,
        eligibility,
        description: `${company} is hiring a ${title}. You will work with an experienced team on real projects, with mentoring and a structured onboarding programme.`,
        deadline: daysFromNow(days),
        createdBy: admin._id,
      }),
    );
  }

  // One job that has already closed, and one past its deadline, so those states show up in the UI
  await Job.create({
    title: 'Systems Analyst', company: 'Old Harbour Co', type: 'full-time', location: 'Delhi', ctc: 7,
    description: 'Recruitment for this role has closed.', deadline: daysFromNow(12), status: 'closed', createdBy: admin._id,
  });
  await Job.create({
    title: 'Support Engineer', company: 'Quickfix Ltd', type: 'full-time', location: 'Noida', ctc: 4.5,
    description: 'Applications for this role ended last week.', deadline: daysFromNow(-6), createdBy: admin._id,
  });

  let created = 0;
  for (const [si, ji, path] of APPLICATIONS) {
    const { user, profile } = students[si];
    const job = jobs[ji];
    const check = checkEligibility(profile.toObject(), job.toObject());
    if (!check.eligible) throw new Error(`Seed data error: ${user.name} is not eligible for ${job.title}: ${check.reasons.join('; ')}`);

    const start = Date.now() - (path.length + 2) * day;
    const statusHistory = [{ status: 'applied', changedBy: user._id, at: new Date(start) }];
    path.forEach((status, i) => {
      statusHistory.push({
        status,
        changedBy: status === 'withdrawn' ? user._id : admin._id,
        at: new Date(start + (i + 1) * day),
        ...(REMARKS[status] && { remark: REMARKS[status] }),
      });
    });
    await Application.create({
      student: user._id,
      job: job._id,
      profile: profile._id,
      status: statusHistory.at(-1).status,
      statusHistory,
    });
    created++;
  }

  console.log(`Seeded 1 admin, ${students.length} students, ${jobs.length + 2} jobs, ${created} applications.`);
  console.log(`Admin:   ${ADMIN_EMAIL}`);
  console.log(`Student: ${students[0].user.email}  (more: ${students.slice(1, 4).map((s) => s.user.email).join(', ')}, ...)`);
  console.log('Password: the DEMO_PASSWORD you provided.');
}

try {
  await main();
} catch (err) {
  console.error(`Demo seed failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
