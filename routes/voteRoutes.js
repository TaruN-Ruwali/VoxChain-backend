const express = require('express');
const router = express.Router();
const { castVote, getResults, verifyVote } = require('../controllers/voteController');
const { protect } = require('../middleware/auth');
const { voteValidators, txIdValidators } = require('../middleware/validators');

router.post('/vote', protect, voteValidators, castVote);
router.get('/results', getResults);
router.get('/verify/:txId', txIdValidators, verifyVote);

module.exports = router;
