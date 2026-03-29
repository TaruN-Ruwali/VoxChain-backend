const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    voterId: {
      type: String,
      unique: true,
    },
    nationalId: {
      type: String,
      trim: true,
    },
    hasVoted: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ['voter', 'admin'],
      default: 'voter',
    },
  },
  { timestamps: true }
);

const generateVoterId = () => 'VX' + Math.floor(10000 + Math.random() * 90000).toString();

userSchema.pre('save', async function (next) {
  if (this.isNew) {
    let id = generateVoterId();
    while (await mongoose.model('User').exists({ voterId: id })) {
      id = generateVoterId();
    }
    this.voterId = id;
  }
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    voterId: this.voterId,
    hasVoted: this.hasVoted,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
