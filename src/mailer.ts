import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  //"user" and "pass" need move to ENV file
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // upgrade with STARTTLS
  auth: {
    user: 'royinagar2@gmail.com',
    pass: 'pryk uqde apyp kuwl',
  },
});

export default transporter;
