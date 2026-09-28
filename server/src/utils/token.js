import jwt from 'jsonwebtoken';

const ALGORITHM = 'HS256';

export const signToken = (user) =>
  jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: ALGORITHM,
  });

// Pinning the algorithm blocks alg-swap attacks ("none", RS/HS confusion)
export const verifyToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });
