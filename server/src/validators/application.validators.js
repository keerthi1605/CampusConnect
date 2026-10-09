import { z } from 'zod';
import { ADMIN_SETTABLE, APPLICATION_STATUS } from '../constants/applicationStatus.js';
import { emptyToUndefined, objectId, paginationQuery } from './common.js';

const statusFilter = emptyToUndefined(z.enum(Object.values(APPLICATION_STATUS)));

export const listMyApplicationsSchema = {
  query: z.object({ ...paginationQuery, status: statusFilter }),
};

export const listJobApplicationsSchema = {
  params: z.object({ id: objectId }),
  query: z.object({ ...paginationQuery, status: statusFilter }),
};

export const updateStatusSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum(ADMIN_SETTABLE, `Status must be one of: ${ADMIN_SETTABLE.join(', ')}`),
    remark: emptyToUndefined(z.string().trim().max(500)),
  }),
};
