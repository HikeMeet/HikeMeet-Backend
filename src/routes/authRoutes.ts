import nodemailer from 'nodemailer'; 
import jwt from 'jsonwebtoken'; // add: for creating JWT                    / i DONT THINK ITS USED in JWT
import { Request, Response } from 'express';
import { User } from '../models/User'; // Import the User model

import admin from "firebase-admin";
import router from '.';
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
  //firebase.admin
  
  // מסלול לעדכון סיסמא
  router.post("/update-password", async (req, res) => {
    const { email, newPassword } = req.body;
  
    if (!email || !newPassword) {
      return res.status(400).send({ error: "Email and new password are required." });
    }
  
    try {
      // מצא את המשתמש לפי המייל
      const user = await admin.auth().getUserByEmail(email);
  
      if (!user) {
        return res.status(404).send({ error: "User not found." });
      }
  
      // עדכן את הסיסמה
      await admin.auth().updateUser(user.uid, { password: newPassword });
  
      return res.status(200).send({ message: "Password updated successfully." });
    } catch (error) {
      console.error("Error updating password:", error.message);
      return res.status(500).send({ error: error.message || "Internal Server Error" });
    }
  });
  
  
  
  
  
  
  
  export default router;

  
  
  
  //////////////////////////////////////////////////////////////////////////