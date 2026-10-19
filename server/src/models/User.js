import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = Object.freeze({ STUDENT: 'student', ADMIN: 'admin' });

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Cost 12 in production; tests lower it (BCRYPT_ROUNDS) because hashing is deliberately slow
const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);

// passwordHash is select:false — load it with .select('+passwordHash') before calling
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

export default mongoose.model('User', userSchema);
