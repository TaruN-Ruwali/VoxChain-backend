const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const registerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('nationalId').optional().trim(),
  validate,
];

const loginValidators = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const voteValidators = [
  body('candidateId').trim().notEmpty().withMessage('Candidate ID is required'),
  body('candidateName').trim().notEmpty().withMessage('Candidate name is required').isLength({ max: 100 }),
  validate,
];

const txIdValidators = [
  param('txId').notEmpty().withMessage('Transaction ID is required').isLength({ min: 4, max: 120 }),
  validate,
];

module.exports = { registerValidators, loginValidators, voteValidators, txIdValidators };
