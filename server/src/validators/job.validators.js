import { z } from 'zod';
import { BRANCHES } from '../constants/branches.js';
import { JOB_TYPES } from '../constants/jobTypes.js';
import { emptyToUndefined, paginationQuery } from './common.js';

// Bare field schemas with no .default() — reused as-is for the update patch below, since
// zod applies a field's .default() on `undefined` even through .optional()/.partial(),
// which would make an omitted field reset to its default instead of staying unchanged.
const minCgpaField = z.number().min(0).max(10);
const branchesField = z.array(z.enum(BRANCHES));
const maxBacklogsField = z.number().int().min(0);
const batchYearField = z.number().int().min(2000).max(2100);

const eligibilityInput = z
  .object({
    minCgpa: minCgpaField.default(0),
    branches: branchesField.default([]),
    maxBacklogs: emptyToUndefined(maxBacklogsField),
    batchYear: emptyToUndefined(batchYearField),
  })
  .default({});

const futureDeadline = z.coerce
  .date('Deadline must be a valid date')
  .refine((d) => d.getTime() > Date.now(), 'Deadline must be in the future');

export const createJobSchema = {
  body: z.object({
    title: z.string().trim().min(2).max(150),
    company: z.string().trim().min(2).max(150),
    description: z.string().trim().min(10).max(5000),
    location: emptyToUndefined(z.string().trim().max(150)),
    type: z.enum(JOB_TYPES),
    ctc: emptyToUndefined(z.number().min(0)),
    deadline: futureDeadline,
    eligibility: eligibilityInput,
  }),
};

// Partial: only the fields the admin wants to change. Built from the same bare field
// schemas as eligibilityInput, but with NO defaults, so an omitted field is left out of
// the parsed result entirely (see the note above) rather than reset to 0 / [].
const eligibilityPatch = z.object({
  minCgpa: minCgpaField.optional(),
  branches: branchesField.optional(),
  maxBacklogs: emptyToUndefined(maxBacklogsField),
  batchYear: emptyToUndefined(batchYearField),
});

export const updateJobSchema = {
  body: z
    .object({
      title: z.string().trim().min(2).max(150),
      company: z.string().trim().min(2).max(150),
      description: z.string().trim().min(10).max(5000),
      location: emptyToUndefined(z.string().trim().max(150)),
      type: z.enum(JOB_TYPES),
      ctc: emptyToUndefined(z.number().min(0)),
      deadline: futureDeadline,
      status: z.enum(['open', 'closed']),
      eligibility: eligibilityPatch,
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update'),
};

const SORTS = ['deadline', '-deadline', 'createdAt', '-createdAt', 'ctc', '-ctc'];

export const listJobsSchema = {
  query: z.object({
    ...paginationQuery,
    q: emptyToUndefined(z.string().trim().max(100)),
    type: emptyToUndefined(z.enum(JOB_TYPES)),
    // 'open' (default) hides closed and expired jobs; 'closed' shows only those; 'all' shows everything
    status: z.enum(['open', 'closed', 'all']).default('open'),
    sort: z.enum(SORTS).default('deadline'),
  }),
};
