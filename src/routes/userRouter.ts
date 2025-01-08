import express, { Request, Response } from 'express';
import { User } from '../models/User'; // Import the User model
import nodemailer from 'nodemailer'; 
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken'; // add: for creating JWT                    / i DONT THINK ITS USED in JWT
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables


//all what I add
//////////////////////////////////////////////////////
// Validate FIREBASE_PRIVATE_KEY
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is not defined in environment variables");
}


// Define the service account object with type assertion
const serviceAccount = {
  type: process.env.FIREBASE_TYPE || "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "",
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL || "",
  client_id: process.env.FIREBASE_CLIENT_ID || "",
  auth_uri: process.env.FIREBASE_AUTH_URI || "",
  token_uri: process.env.FIREBASE_TOKEN_URI || "",
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || "",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL || "",
};

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});


// nodemailer transport
const transporter = nodemailer.createTransport({
  service: "Gmail", // או השירות שבו אתה משתמש
  auth: {
    user: 'royinagar2@gmail.com',
    pass: 'pryk uqde apyp kuwl',
  },
});
//////////////////////////////////////////////////////
//all what I add







const router = express.Router();

/**
 *  In-memory Map for storing verification codes
 *  Note: In production, consider using Redis or another DB
 */
const verificationCodesMap: {
  [email: string]: {
    code: string;
    expires: Date;
  };
} = {};











// POST /insert route
router.post('/insert', async (req: Request, res: Response) => {
  try {
    console.log('inserting');
    // Extract user data from the request body
    const { username, email, first_name, last_name, gender, birth_date, profile_picture, bio, facebook_link, instagram_link, role, firebase_id } = req.body;

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

// GET /:mongoId - Get a user by ID or Firebase ID
router.get('/:mongoId', async (req: Request, res: Response) => {
  try {
    const { mongoId } = req.params;
    const firebase = req.query.firebase === 'true'; // Default is false if not provided
    console.log(mongoId, ' xxxx ', firebase);
    let user;

    if (firebase) {
      // Search for the user by Firebase UID
      user = await User.findOne({ firebase_id: mongoId });
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

// POST /:id/update - Edit a user by ID
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




//all what I add

//////////////////////////////////////////////////////////////////////////
// POST /send-verification-code
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

    const now = new Date();
    if (verificationCodesMap[email] && verificationCodesMap[email].expires > now) {
      return res.status(400).json({ error: "Please wait 1 minutes before requesting another code." });
    }

    const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(now.getTime() + 1 * 60 * 1000); // 1 minutes

    verificationCodesMap[email] = {
      code: verificationCode,
      expires,
    };

    console.log("Generated verification code:", verificationCode);
    console.log("Expires at:", expires);

    
    const mailOptions = {
      from: '"HikeMeet Team" <HikeMeet@gmail.com>', // שם מותאם אישית ושם האימייל
      to: email,
      subject: "Your Verification Code",
      html: `
        <p>Your verification code is:</p>
        <h3>${verificationCode}</h3>
        <p>This code will expire in 10 minutes.</p>
      `,
    };
    

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: "Verification code sent successfully" });
  } catch (error) {
    console.error("Error sending verification code:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /verify-code
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

    // שולפים מהמפה (in-memory) את הקוד השמור
    const storedData = verificationCodesMap[email];

    if (!storedData) {
      console.error("No verification code stored for email:", email);
      return res.status(400).json({ error: "No verification code found or code expired" });
    }

    // בודקים אם הקוד תואם או פג תוקף
    const isCodeValid = (storedData.code === code) && (storedData.expires > new Date());
    if (!isCodeValid) {
      console.error("Invalid or expired verification code for email:", email);
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    // הסרה מהמפה - שלא יהיה ניתן להשתמש שוב
    delete verificationCodesMap[email];
    console.log("Verification successful for email:", email);

    // אופציונלי: הפקת JWT כדי "להוכיח" שהמשתמש אומת
    // (התוקף כאן למשל 1 שעה, לשיקולך)
    const secretKey = process.env.JWT_SECRET || "fallback-secret";
    const token = jwt.sign({ email: user.email, uid: user._id }, secretKey, {
      expiresIn: "1h",
    });

    return res.status(200).json({
      message: "Verification successful",
      token,
    });
  } catch (error) {
    console.error("Error verifying code for email:", email, error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
//////////////////////////////////////////////////////////////////////////

export default router;
