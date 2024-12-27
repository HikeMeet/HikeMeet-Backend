import nodemailer from 'nodemailer';

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'royinagar2@gmail.com', // Replace with your email
    pass: 'pryk uqde apyp kuwl',  // Replace with your app password
  },
});

/**
 * Function to send verification email
 * @param email - The recipient's email address
 * @param code - The verification code
 */
export const sendVerificationEmail = async (email: string, code: string): Promise<void> => {
  const mailOptions = {
    from: 'royinagar2@gmail.com',
    to: email,
    subject: 'Account Verification',
    html: `<p>Hello,</p><p>Your verification code is: <strong>${code}</strong></p><p>Thank you!</p>`,
};

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send verification email');
  }
};
