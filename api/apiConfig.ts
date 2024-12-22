const BASE_URL = "http://192.168.1.5:5000";  //change to your ip

export const getApiUrl = (endpoint: string): string => `${BASE_URL}${endpoint}`;
