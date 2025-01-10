interface VerificationCodeData {
    code: string;
    expires: Date;
  }
  
  const verificationCodesMap: { [email: string]: VerificationCodeData } = {};
  
  export const generateVerificationCode = (email: string): VerificationCodeData => {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    verificationCodesMap[email] = { code, expires };
    return { code, expires };
  };
  
  export const getVerificationCode = (email: string): VerificationCodeData | null => {
    return verificationCodesMap[email] || null;
  };
  
  export const deleteVerificationCode = (email: string): void => {
    delete verificationCodesMap[email];
  };
  