import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({   //"user" and "pass" need move to ENV file
  service: "Gmail",
  auth: {
    user: "royinagar2@gmail.com",
    pass: "pryk uqde apyp kuwl",
  },
});

export default transporter;
