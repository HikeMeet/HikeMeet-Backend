import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  //"user" and "pass" need move to ENV file
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // upgrade with STARTTLS
  auth: {
    user: process.env.MAILER_EMAIL,
    pass: process.env.MAILER_PASSWORD,
  },
});

export default transporter;
