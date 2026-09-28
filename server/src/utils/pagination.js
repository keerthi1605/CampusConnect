export const toSkip = ({ page, limit }) => (page - 1) * limit;

export const pageMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit)),
});

/** '-cgpa' -> { cgpa: -1, _id: 1 }. The _id tie-breaker keeps pages stable when values repeat. */
export const toSort = (sort) => {
  const desc = sort.startsWith('-');
  return { [desc ? sort.slice(1) : sort]: desc ? -1 : 1, _id: 1 };
};
