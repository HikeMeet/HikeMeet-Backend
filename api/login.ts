import axios from "axios";
import { getApiUrl } from "./apiConfig";
import { saveToken } from "../services/tokenService";

export interface LoginUserParams {
  email: string;
  password: string;
}

export interface LoginUserResponse {
  success: boolean;
  token?: string;
  uid?: string;
  error?: string;
}

export const loginUser = async ({
  email,
  password,
}: LoginUserParams): Promise<LoginUserResponse> => {
  try {
    const response = await axios.post(getApiUrl("/api/login"), {
      email,
      password,
    });

    const token = response.data.token;

    if (token) {
      await saveToken(token);
    }

    return {
      success: true,
      token: response.data.token,
      uid: response.data.uid,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || "שגיאה בהתחברות. נסה שוב מאוחר יותר.",
    };
  }
};
