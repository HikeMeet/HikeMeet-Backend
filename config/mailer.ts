import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.MAILER_USER || "",
    pass: process.env.MAILER_PASS || "",
  },
});

export default transporter;
