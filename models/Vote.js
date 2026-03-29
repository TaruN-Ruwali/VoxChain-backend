const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    voterId: {
      type: String,
      required: [true, 'Voter ID is required'],
      unique: true,
    },
    candidate: {
      type: String,
      required: [true, 'Candidate is required'],
      trim: true,
    },
    candidateId: {
      type: String,
      required: [true, 'Candidate ID is required'],
      trim: true,
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true,
    },
    simulated: {
      type: Boolean,
      default: false,
    },
    confirmedRound: {
      type: Number,
      default: null,
    },
    ipAddress: {
      type: String,
      select: false,
    },
  },
  { timestamps: true }
);

voteSchema.index({ candidate: 1 });
voteSchema.index({ candidateId: 1 });

module.exports = mongoose.model('Vote', voteSchema);
