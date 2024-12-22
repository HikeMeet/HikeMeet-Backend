import axios from "axios";
import { getApiUrl } from "./apiConfig";
import { getToken } from "../services/tokenService";

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string;
}

export const fetchUserProfile = async (): Promise<UserProfile> => {
  try {
    const token = await getToken(); // שליפת הטוקן מ-AsyncStorage

    if (!token) {
      throw new Error("Token not found. Please login again.");
    }

    const response = await axios.get(getApiUrl("/api/user/profile"), {
      headers: {
        Authorization: `Bearer ${token}`, // שליחת הטוקן בכותרת
      },
    });

    const { id, firstName, lastName, email, profilePicture } = response.data;

    return {
      id,
      firstName,
      lastName,
      email,
      profilePicture: profilePicture || "https://via.placeholder.com/100", // תמונת ברירת מחדל
    };
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message || "שגיאה בקבלת פרטי המשתמש. נסה שוב מאוחר יותר."
    );
  }
};
