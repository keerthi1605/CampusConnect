import { z } from 'zod';
import { BRANCHES } from '../constants/branches.js';
import { emptyToUndefined, paginationQuery } from './common.js';

// Trim, drop blanks, de-duplicate case-insensitively (keeps first spelling),
// then enforce the size limit on the cleaned list
const skills = z
  .array(z.string().trim().max(40, 'A skill can be at most 40 characters'))
  .transform((list) => {
    const seen = new Set();
    return list.filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })
  .pipe(z.array(z.string()).max(20, 'At most 20 skills'));

// PUT /students/me replaces the whole profile: omitted optional fields are cleared.
// `user`, `_id` etc. are not listed, so zod strips them (no mass-assignment).
export const upsertProfileSchema = {
  body: z.object({
    rollNo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,20}$/, 'Roll number must be 3-20 letters, digits or hyphens'),
    branch: z.enum(BRANCHES, `Branch must be one of: ${BRANCHES.join(', ')}`),
    cgpa: z.number('CGPA must be a number').min(0).max(10),
    batchYear: z.number('Batch year must be a number').int().min(2000).max(2100),
    backlogs: z.number().int().min(0).default(0),
    phone: emptyToUndefined(z.string().trim().regex(/^\d{10}$/, 'Phone must be 10 digits')),
    skills: skills.default([]),
    // http(s) only: a stored javascript: URL would be an XSS vector when rendered as a link
    resumeUrl: emptyToUndefined(z.url({ protocol: /^https?$/, error: 'Resume link must be an http(s) URL' }).max(500)),
  }),
};

const SORTS = ['createdAt', '-createdAt', 'cgpa', '-cgpa', 'rollNo', '-rollNo', 'batchYear', '-batchYear'];

export const listStudentsSchema = {
  query: z.object({
    ...paginationQuery,
    q: emptyToUndefined(z.string().trim().max(100)),
    branch: emptyToUndefined(z.enum(BRANCHES)),
    batchYear: emptyToUndefined(z.coerce.number().int()),
    minCgpa: emptyToUndefined(z.coerce.number().min(0).max(10)),
    maxCgpa: emptyToUndefined(z.coerce.number().min(0).max(10)),
    maxBacklogs: emptyToUndefined(z.coerce.number().int().min(0)),
    sort: z.enum(SORTS).default('-createdAt'),
  }),
};
