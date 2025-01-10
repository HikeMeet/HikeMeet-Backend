import { Router, Request, Response } from "express";
import transporter from "../../config/mailer";
import admin from "../../config/firebaseAdmin";
import { generateVerificationCode, getVerificationCode, deleteVerificationCode } from "../helpers/verificationCodes";
import { User } from "../models/User";

const router = Router();

//POST /Send-verification-code
router.post("/send-verification-code", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: "User not found" });

  const { code } = generateVerificationCode(email);
  const mailOptions = {
    from: '"HikeMeet Team" <HikeMeet@gmail.com>',
    to: email,
    subject: "Your Verification Code",
    html: `<p>Your verification code is:</p><h3>${code}</h3><p>This code will expire in 10 minutes.</p>`,
  };

  await transporter.sendMail(mailOptions);
  res.status(200).json({ message: "Verification code sent successfully" });
});

//POST /Verify-code
router.post("/verify-code", async (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

  const storedCode = getVerificationCode(email);
  if (!storedCode || storedCode.code !== code || storedCode.expires < new Date()) {
    return res.status(400).json({ error: "Invalid or expired verification code" });
  }

  deleteVerificationCode(email);
  res.status(200).json({ message: "Verification successful" });
});

//POST /Update-password to firebase admin
router.post("/update-password", async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).send({ error: "Email and new password are required." });

  const user = await admin.auth().getUserByEmail(email);
  if (!user) return res.status(404).send({ error: "User not found." });

  await admin.auth().updateUser(user.uid, { password: newPassword });
  res.status(200).send({ message: "Password updated successfully." });
});

export default router;
