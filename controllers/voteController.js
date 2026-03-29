const Vote = require('../models/Vote');
const User = require('../models/User');
const { submitVoteTransaction, verifyTransaction } = require('../config/algorand');
const { asyncHandler } = require('../middleware/errorHandler');

const getVoteCounts = async () => {
  return Vote.aggregate([
    {
      $group: {
        _id: { candidateId: '$candidateId', candidate: '$candidate' },
        votes: { $sum: 1 },
        lastVote: { $max: '$createdAt' },
      },
    },
    {
      $project: {
        _id: 0,
        candidateId: '$_id.candidateId',
        candidate: '$_id.candidate',
        votes: 1,
        lastVote: 1,
      },
    },
    { $sort: { votes: -1 } },
  ]);
};

// POST /api/vote
const castVote = asyncHandler(async (req, res) => {
  const { candidateId, candidateName } = req.body;
  const user = req.user;

  // Check hasVoted flag
  if (user.hasVoted) {
    return res.status(403).json({ success: false, message: 'You have already cast your vote.' });
  }

  // Double-check DB (race condition guard)
  const existingVote = await Vote.findOne({ voterId: user.voterId });
  if (existingVote) {
    await User.findByIdAndUpdate(user._id, { hasVoted: true });
    return res.status(403).json({ success: false, message: 'You have already cast your vote.' });
  }

  // Submit blockchain transaction
  const txResult = await submitVoteTransaction(user.voterId, candidateId);

  // Store vote
  const vote = await Vote.create({
    voterId: user.voterId,
    candidate: candidateName.trim(),
    candidateId: candidateId.trim(),
    transactionId: txResult.txId,
    simulated: txResult.simulated,
    confirmedRound: txResult.confirmedRound || null,
    ipAddress: req.ip,
  });

  // Mark user as voted
  await User.findByIdAndUpdate(user._id, { hasVoted: true });

  // Get updated results for real-time broadcast
  const results = await getVoteCounts();
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  // Emit via Socket.io
  const io = req.app.get('io');
  if (io) {
    io.emit('voteUpdate', {
      candidateId,
      candidateName,
      results,
      totalVotes,
      latestTransaction: {
        txId: txResult.txId,
        simulated: txResult.simulated,
        timestamp: vote.createdAt,
      },
    });
  }

  res.status(201).json({
    success: true,
    message: 'Vote cast successfully.',
    data: {
      vote: {
        voterId: vote.voterId,
        candidate: vote.candidate,
        candidateId: vote.candidateId,
        transactionId: vote.transactionId,
        simulated: vote.simulated,
        confirmedRound: vote.confirmedRound,
        timestamp: vote.createdAt,
      },
    },
  });
});

// GET /api/results
const getResults = asyncHandler(async (req, res) => {
  const results = await getVoteCounts();
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

  const recentVotes = await Vote.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .select('candidate candidateId transactionId simulated createdAt');

  res.status(200).json({
    success: true,
    data: { results, totalVotes, recentVotes },
  });
});

// GET /api/verify/:txId
const verifyVote = asyncHandler(async (req, res) => {
  const { txId } = req.params;

  const voteRecord = await Vote.findOne({ transactionId: txId }).select('-ipAddress');
  if (!voteRecord) {
    return res.status(404).json({ success: false, message: 'No vote record found for this transaction ID.' });
  }

  const chainData = await verifyTransaction(txId);

  res.status(200).json({
    success: true,
    data: {
      voteRecord: {
        voterId: voteRecord.voterId,
        candidate: voteRecord.candidate,
        candidateId: voteRecord.candidateId,
        transactionId: voteRecord.transactionId,
        simulated: voteRecord.simulated,
        confirmedRound: voteRecord.confirmedRound,
        timestamp: voteRecord.createdAt,
      },
      blockchain: chainData,
    },
  });
});

module.exports = { castVote, getResults, verifyVote };
