import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";

export default function NavigationBar() {
  const router = useRouter();

  return (
    <View className="absolute bottom-0 left-0 w-full flex-row justify-between items-center bg-white shadow-md p-3">
      {/* Profile Icon */}
      <TouchableOpacity onPress={() => router.push("/profile/my_profile")} className="flex-1 items-center relative">
        <Image
          source={{ uri: "https://via.placeholder.com/40" }}
          className="w-10 h-10 rounded-full"
        />
        <View className="w-2 h-2 bg-red-500 rounded-full absolute top-1 right-5"></View>
      </TouchableOpacity>

      {/* Chat Icon */}
      <TouchableOpacity className="flex-1 items-center" onPress={() => router.push("/chat")}>
        <MaterialIcons name="chat" size={24} color="black" />
      </TouchableOpacity>

      {/* Add Post Icon */}
      <TouchableOpacity className="flex-1 items-center" onPress={() => router.push("/add-post")}>
        <FontAwesome5 name="plus-square" size={24} color="black" />
      </TouchableOpacity>

      {/* Videos Icon */}
      <TouchableOpacity className="flex-1 items-center" onPress={() => router.push("/videos")}>
        <MaterialIcons name="video-library" size={24} color="black" />
      </TouchableOpacity>

      {/* Explore Icon */}
      <TouchableOpacity className="flex-1 items-center" onPress={() => router.push("/explore")}>
        <FontAwesome5 name="compass" size={24} color="black" />
      </TouchableOpacity>

      {/* Home Icon */}
      <TouchableOpacity onPress={() => router.push("/home_page/home")} className="flex-1 items-center">
        <FontAwesome5 name="home" size={24} color="black" />
      </TouchableOpacity>
    </View>
  );
}
