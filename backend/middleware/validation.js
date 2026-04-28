const { body, param, query, validationResult } = require('express-validator');

// Helper to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

const validateRequest = (requiredFields = []) => (req, res, next) => {
  const missingFields = requiredFields.filter((field) => {
    const value = req.body?.[field];

    if (value === undefined || value === null) {
      return true;
    }

    return typeof value === 'string' && value.trim() === '';
  });

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: missingFields.map((field) => ({
        field,
        message: `${field} is required`,
        value: req.body?.[field]
      }))
    });
  }

  return next();
};

// Auth validators
const signupValidator = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  handleValidationErrors
];

const loginValidator = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const otpValidator = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  handleValidationErrors
];

const verifyOtpValidator = [
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Valid 6-digit OTP is required'),
  handleValidationErrors
];

const mpinValidator = [
  body('mpin')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('MPIN must be 4-6 digits'),
  handleValidationErrors
];

const setMpinValidator = [
  body('mpin')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('MPIN must be 4-6 digits'),
  body('confirmMpin')
    .custom((value, { req }) => {
      if (value !== req.body.mpin) {
        throw new Error('MPINs do not match');
      }
      return true;
    }),
  handleValidationErrors
];

const usernameValidator = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and dashes'),
  handleValidationErrors
];

// Dating profile validators
const profileValidator = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name is required and must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name contains invalid characters'),
  body('age')
    .isInt({ min: 18, max: 120 })
    .withMessage('Age must be between 18 and 120'),
  body('gender')
    .isIn(['male', 'female', 'non-binary', 'other'])
    .withMessage('Invalid gender value'),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio must be less than 1000 characters'),
  body('relationshipGoals')
    .optional()
    .isIn(['casual', 'dating', 'relationship', 'marriage', 'friendship'])
    .withMessage('Invalid relationship goals'),
  body('interests')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Maximum 20 interests allowed'),
  body('height')
    .optional()
    .isInt({ min: 100, max: 250 })
    .withMessage('Height must be between 100cm and 250cm'),
  handleValidationErrors
];

const photoUploadValidator = [
  body('photos')
    .optional()
    .isArray({ min: 1, max: 10 })
    .withMessage('You can upload 1-10 photos'),
  handleValidationErrors
];

// Messaging validators
const messageValidator = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  param('matchId')
    .isInt()
    .withMessage('Valid match ID is required'),
  handleValidationErrors
];

// Block/Report validators
const blockValidator = [
  body('blockedUserId')
    .isInt()
    .withMessage('Valid user ID is required'),
  handleValidationErrors
];

const reportValidator = [
  body('reportedUserId')
    .isInt()
    .withMessage('Valid user ID is required'),
  body('reason')
    .trim()
    .notEmpty()
    .isLength({ max: 255 })
    .withMessage('Reason is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  handleValidationErrors
];

// Pagination validator
const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRequest,
  signupValidator,
  loginValidator,
  otpValidator,
  verifyOtpValidator,
  mpinValidator,
  setMpinValidator,
  usernameValidator,
  profileValidator,
  photoUploadValidator,
  messageValidator,
  blockValidator,
  reportValidator,
  paginationValidator
};
