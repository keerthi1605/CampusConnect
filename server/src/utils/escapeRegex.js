// Makes user input safe to embed in a RegExp (prevents ".*" matching everything / ReDoS patterns)
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
