import React from "react";
import { Stack } from "expo-router";
import { View, Text, TouchableOpacity, ImageBackground } from "react-native";
import { useRouter } from "expo-router";

const HomeScreen = () => {
  const router = useRouter();

  return (
    <ImageBackground
      source={require("../assets/landing_page.jpg")}
      className="flex-1 justify-center items-center"
      resizeMode="cover"
    >
      <View className="flex-1 justify-center items-center bg-black bg-opacity-50 w-full h-full">
        <Text className="text-4xl font-bold text-white mb-5">HikeMeet</Text>
        <Text className="text-lg text-white mb-6">
          ברוך הבא לאפליקציית הטיולים שלך!
        </Text>

        <View className="bg-white bg-opacity-90 rounded-lg p-6 shadow-lg">
          <TouchableOpacity
            className="bg-blue-500 py-3 px-5 rounded mb-4"
            onPress={() => router.push("/register_login/login")}
          >
            <Text className="text-white font-semibold text-center text-lg">
              Login
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-green-500 py-3 px-5 rounded"
            onPress={() => router.push("/register_login/register")}
          >
            <Text className="text-white font-semibold text-center text-lg">
              Register
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
};

const Home = () => (
  <>
    <Stack.Screen
      options={{
        title: "HikeMeet",
      }}
    />
    <HomeScreen />
  </>
);

export default Home;
