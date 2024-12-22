import React, { useState } from "react";
import { Text, TextInput, View, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { loginUser } from "api/login";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const result = await loginUser({
      email,
      password,
    });

    if (result.success && result.token) {
      try {
        await AsyncStorage.setItem("token", result.token);
        Alert.alert("Login Successful!", "Welcome back!", [
          { text: "OK", onPress: () => router.push("/home_page/home") },
        ]);
      } catch (error) {
        Alert.alert("Error", "An error occurred while saving the token");
      }
    } else {
      Alert.alert("Login Error", result.error || "Something went wrong");
    }
  };

  return (
    <View className="flex-1 justify-center items-center bg-gradient-to-b from-blue-500 to-purple-600 px-5">
      <View className="bg-white w-full max-w-md p-6 rounded-2xl shadow-lg -mt-20">
        <Text className="text-2xl font-bold text-center mb-5 text-gray-800">Login</Text>
        <TextInput
          className="w-full p-4 border border-gray-300 rounded-lg mb-4 text-gray-700"
          placeholder="Email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor="#aaa"
        />
        <TextInput
          className="w-full p-4 border border-gray-300 rounded-lg mb-4 text-gray-700"
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity
          className="bg-blue-500 py-3 rounded-lg shadow-md active:bg-blue-600"
          onPress={handleLogin}
        >
          <Text className="text-white text-center font-semibold text-lg">Login</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/register_login/register")}>
          <Text className="mt-5 text-blue-500 underline text-center">
            Not registered yet? <Text className="text-indigo-500">Go to Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
