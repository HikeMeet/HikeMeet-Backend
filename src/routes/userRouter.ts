import express, { Request, Response } from 'express';
import { User } from '../models/User'; // Import the User model
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is not defined in environment variables");
}

const serviceAccount = {
  type: process.env.FIREBASE_TYPE || "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "",
  private_key: privateKey.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL || "",
  client_id: process.env.FIREBASE_CLIENT_ID || "",
  auth_uri: process.env.FIREBASE_AUTH_URI || "",
  token_uri: process.env.FIREBASE_TOKEN_URI || "",
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || "",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// מגדיר את נודמיילר
const transporter = nodemailer.createTransport({
  service: "Gmail", // או השירות שבו אתה משתמש
  auth: {
    user: 'royinagar2@gmail.com',
    pass: 'pryk uqde apyp kuwl'
  },
});




const router = express.Router();


// POST /insert route
router.post('/insert', async (req: Request, res: Response) => {
  console.log("aaaaaaaaaaaaaaaaaaaa");
  try {
    console.log('inserting');
    // Extract user data from the request body
    const { username, email, first_name, last_name, gender, birth_date, profile_picture, bio, facebook_link, instagram_link, role, firebase_id } =
      req.body;

    // Validate required fields
    const requiredFields = ['username', 'email', 'first_name', 'last_name', 'firebase_id'];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      const missingFieldsList = missingFields.join(', ');
      return res.status(400).json({
        error: `Missing required fields: ${missingFieldsList}`,
        missing_fields: missingFields,
      });
    }
    // Check if the user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      const conflictMessages = [];

      // Check if the conflict is due to email
      if (existingUser.email === email) {
        conflictMessages.push('Email already exists.');
      }

      // Check if the conflict is due to username
      if (existingUser.username === username) {
        conflictMessages.push('Username already exists.');
      }

      // Return appropriate message(s)
      return res.status(409).json({
        error: conflictMessages.join(' '), // Combine all conflict messages
      });
    }

    // Create a new user
    const newUser = new User({
      username,
      email,
      first_name,
      last_name,
      gender: gender || '',
      birth_date: birth_date || '',
      profile_picture: profile_picture || '',
      bio: bio || '',
      facebook_link: facebook_link || '',
      instagram_link: instagram_link || '',
      role: role || 'user', // Default to 'user'
      firebase_id,
      social: {
        total_likes: 0,
        total_shares: 0,
        total_saves: 0,
      },
      created_on: new Date(),
      updated_on: new Date(),
    });

    // Save the user to the database
    await newUser.save();

    // Send a success response
    res.status(200).json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error('Error inserting user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /user/:id - Get a user by ID
router.get('/:mongoId', async (req: Request, res: Response) => {
  try {
    const { mongoId } = req.params;
    const firebase = req.query.firebase === 'true'; // Default is false if not provided
    console.log(mongoId, ' xxxx ', firebase);
    let user;

    if (firebase) {
      // Search for the user by Firebase UID
      user = await User.findOne({ firebase_id: mongoId }); // Assuming 'firebaseUid' is the field in your schema
    } else {
      // Search for the user by MongoDB ID
      user = await User.findById(mongoId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /user/:id/update - Edit a user by ID
router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const updates = req.body; // Updates from the request body
    updates.updated_on = new Date();
    // Find the user and update
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


////////////////////////////////////////////////////////////////////////////////////
router.post('/send-verification-code', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // יצירת קוד רנדומלי בן 5 ספרות
    const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 דקות

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = expires;
    await user.save();

    console.log("Generated verification code:", verificationCode);
    console.log("Expires at:", expires);

    // שליחת הקוד למייל
    const mailOptions = {
      from: "your-email@gmail.com",
      to: email,
      subject: "Your Verification Code",
      html: `
        <p>Your verification code is:</p>
        <h3>${verificationCode}</h3>
        <p>This code will expire in 10 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Verification code sent successfully" });
  } catch (error) {
    console.error("Error sending verification code:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post('/verify-code', async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    console.error("Missing email or code:", { email, code });
    return res.status(400).json({ error: "Email and code are required" });
  }

  try {
    console.log("Verifying code for email:", email);
    console.log("Received code:", code);

    const user = await User.findOne({ email });

    if (!user) {
      console.error("User not found for email:", email);
      return res.status(404).json({ error: "User not found" });
    }

    console.log("Stored code:", user.verificationCode);
    console.log("Code expiration:", user.verificationCodeExpires);

    if (
      user.verificationCode !== code ||
      !user.verificationCodeExpires ||
      user.verificationCodeExpires <= new Date()
    ) {
      console.error("Invalid or expired verification code for email:", email);
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    // ניקוי הקוד לאחר האימות
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    console.log("Verification successful for email:", email);
    res.status(200).json({ message: "Verification successful" });
  } catch (error) {
    console.error("Error verifying code for email:", email, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


////////////////////////////////////////////////////////////////////////////////////

// DELETE /user/:id/delete - Delete a user by ID
router.delete('/:id/delete', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    // Find and delete the user
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
export default router;
