import { RequestHandler } from 'express';
import Joi from '@hapi/joi';
import bcrypt from 'bcrypt';
import { User } from '../../models/User';
import { relogRequestHandler } from '../../middleware/request-middleware';
import { sendVerificationEmail } from '../../config/emailService';

// Temporary storage for the verification process
let temporaryUser: { username: string; email: string; password: string } | null = null;
let verificationCode: string | null = null;
let verificationExpiryTime: number | null = null;

// Function to generate a 5-digit random verification code
const generateVerificationCode = (): string => Math.floor(10000 + Math.random() * 90000).toString();

// Request schema for verification
export const addUserSchema = Joi.object().keys({
  username: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

// Handle request to send verification code
const requestVerificationWrapper: RequestHandler = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if username or email already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    // Generate 5-digit verification code
    verificationCode = generateVerificationCode();
    verificationExpiryTime = Date.now() + 60 * 1000; // Code valid for 1 minute

    // Hash password and store temporary user
    temporaryUser = {
      username,
      email,
      password: await bcrypt.hash(password, 10),
    };

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    return res.status(200).json({ success: true, message: 'Verification code sent to email' });
  } catch (error) {
    console.error('Error in requestVerification:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const verifyCodeWrapper: RequestHandler = async (req, res) => {
  const { email, code } = req.body;


  if (!verificationCode || !verificationExpiryTime || !temporaryUser) {
    console.error("No active verification process or temporary user not found.");
    return res.status(400).json({ success: false, message: 'No active verification process' });
  }

  if (Date.now() > verificationExpiryTime) {
    console.error("Verification code expired.");
    return res.status(400).json({ success: false, message: 'Verification code expired' });
  }

  if (code !== verificationCode) {
    console.error("Invalid verification code.");
    return res.status(400).json({ success: false, message: 'Invalid verification code' });
  }

  try {
    // Save the user in MongoDB without the password
    const { username, email } = temporaryUser;
    console.log("Saving user to MongoDB:", { username, email });

    const newUser = new User({ username, email, createdOn: Date.now() });
    await newUser.save();

    // Clear temporary data
    temporaryUser = null;
    verificationCode = null;
    verificationExpiryTime = null;

    console.log("User successfully registered.");
    return res.status(201).json({
      success: true,
      message: 'User verified and registered.',
    });
  } catch (error) {
    console.error("Error in verifyCode:", error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const resendCodeWrapper: RequestHandler = async (req, res) => {
  const { email } = req.body;
  
  console.log('Resend Code Request Received:', email);

  if (!temporaryUser || !verificationCode || temporaryUser.email.toLowerCase() !== email.toLowerCase()) {
    console.error('No active verification process or invalid email:', { temporaryUser, verificationCode });
    return res.status(400).json({ success: false, message: 'No active verification process or invalid email' });
  }

  try {
    verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
    verificationExpiryTime = Date.now() + 60 * 1000;

    await sendVerificationEmail(email, verificationCode);

    return res.status(200).json({ success: true, message: 'Verification code resent to email' });
  } catch (error) {
    console.error('Error in resendCode:', error);
    return res.status(500).json({ success: false, message: 'Failed to resend verification code' });
  }
};

// ייצוא הראוטר לטיפול בבקשה
export const resendCode = relogRequestHandler(resendCodeWrapper, {skipJwtAuth: true,});
export const requestVerification = relogRequestHandler(requestVerificationWrapper, {validation: { body: addUserSchema },skipJwtAuth: true,});
export const verifyCode = relogRequestHandler(verifyCodeWrapper, { skipJwtAuth: true });
