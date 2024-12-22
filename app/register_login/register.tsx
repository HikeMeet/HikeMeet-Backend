import React, { useState } from "react";
import { Text, TextInput, View, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { registerUser } from "api/register";

export default function RegisterScreen() {
  const router = useRouter();

  const [username, setUsername] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleRegister = async () => {
    if (!/^[a-zA-Z0-9_]{3,15}$/.test(username)) {
      Alert.alert("Invalid Username", "Username must be 3-15 characters and contain only letters, numbers, or underscores.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert("Invalid Email", "Please provide a valid email address.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters long.");
      return;
    }

    const result = await registerUser({
      username,
      email,
      password,
      firstName,
      lastName,
    });

    if (result.success) {
      Alert.alert("Registration Successful!", "You have successfully registered!", [
        { text: "OK", onPress: () => router.push("/register_login/login") },
      ]);
    } else {
      Alert.alert("Registration Error", result.error || "Something went wrong");
    }
  };

  return (
    <View className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 px-5 justify-center items-center">
      <View className="bg-white w-full max-w-md rounded-2xl shadow-lg p-6">
        <Text className="text-3xl font-bold text-center mb-6 text-gray-800">Register</Text>
        <TextInput
          className="w-full p-4 border border-gray-300 rounded-lg mb-4 text-gray-700"
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          placeholderTextColor="#aaa"
        />
        <TextInput
          className="w-full p-4 border border-gray-300 rounded-lg mb-4 text-gray-700"
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
          placeholderTextColor="#aaa"
        />
        <TextInput
          className="w-full p-4 border border-gray-300 rounded-lg mb-4 text-gray-700"
          placeholder="Last Name"
          value={lastName}
          onChangeText={setLastName}
          placeholderTextColor="#aaa"
        />
        <TextInput
          className="w-full p-4 border border-gray-300 rounded-lg mb-4 text-gray-700"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholderTextColor="#aaa"
        />
        <TextInput
          className="w-full p-4 border border-gray-300 rounded-lg mb-6 text-gray-700"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity
          className="bg-indigo-500 py-3 rounded-lg shadow-md active:bg-indigo-600"
          onPress={handleRegister}
        >
          <Text className="text-white text-center font-semibold text-lg">Register</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/register_login/login")}>
          <Text className="mt-5 text-center text-blue-500 underline">
            Already have an account? <Text className="text-indigo-500">Go to Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
