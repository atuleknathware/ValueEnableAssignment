const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/userRepository');

/**
 * Register a new user
 */
async function register(req, res, next) {
  try {
    const { fullName, dob, mobile, email, password } = req.body;

    // Check if user already exists
    const existingUser = await userRepository.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Hash password using bcrypt (work factor 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user with AES-256-GCM encrypted DOB and mobile
    const user = await userRepository.createUser({
      fullName,
      dob,
      mobile,
      email,
      passwordHash,
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Fetch masked profile for response
    const profile = await userRepository.findUserById(user.id);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        dob: profile.dob,
        mobile: profile.mobile,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log in an existing user
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await userRepository.findUserByEmail(email);
    if (!user) {
      // Use generic message to prevent email enumeration attacks
      return res.status(401).json({
        success: false,
        message: 'Invalid email address or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email address or password.',
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const profile = await userRepository.findUserById(user.id);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        dob: profile.dob,
        mobile: profile.mobile,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get current user profile (masked PII)
 */
async function getMe(req, res, next) {
  try {
    const profile = await userRepository.findUserById(req.user.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        dob: profile.dob,
        mobile: profile.mobile,
        createdAt: profile.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe,
};

