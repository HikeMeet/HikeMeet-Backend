import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput } from "react-native";
import Post from "../components/Post";
import NavigationBar from "../components/NavigationBar";

export default function HomeScreen() {
  const [posts, setPosts] = useState([
    {
      id: 1,
      title: "Trip to the mountains",
      content: "Amazing view!",
      author: "Ron Wizly",
      date: "12.12.2022",
      images: [],
    },
    {
      id: 2,
      title: "Night hike",
      content: "Beautiful stars!",
      author: "Clara Bitch",
      date: "12.12.2022",
      images: ["https://via.placeholder.com/150", "https://via.placeholder.com/150"],
    },
  ]);
  const [newPost, setNewPost] = useState("");
  const [filter, setFilter] = useState("all");

  const handleCreatePost = () => {
    if (newPost.trim()) {
      setPosts([
        {
          id: Date.now(),
          title: newPost,
          content: "New Post!",
          author: "Me",
          date: new Date().toLocaleDateString(),
          images: [],
        },
        ...posts,
      ]);
      setNewPost("");
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="p-4 bg-white shadow-md">
        <Text className="text-2xl font-bold text-gray-800">HikeMeet</Text>
        <View className="flex-row justify-between mt-2">
          <TouchableOpacity
            onPress={() => setFilter("friends")}
            className={filter === "friends" ? "border-b-2 border-blue-500" : ""}
          >
            <Text className="text-lg text-gray-600">Friends Only</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className={filter === "all" ? "border-b-2 border-blue-500" : ""}
          >
            <Text className="text-lg text-gray-600">All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Create Post */}
      <View className="p-4 bg-white shadow-md">
        <TextInput
          className="w-full p-3 border border-gray-300 rounded-lg"
          placeholder="Write a new post..."
          value={newPost}
          onChangeText={setNewPost}
        />
        <TouchableOpacity className="bg-blue-500 mt-3 py-2 rounded-lg" onPress={handleCreatePost}>
          <Text className="text-white text-center">+ Create Post</Text>
        </TouchableOpacity>
      </View>

      {/* Posts */}
      <ScrollView className="p-4">
        {posts.map((post) => (
          <Post key={post.id} {...post} />
        ))}
      </ScrollView>

      {/* Navigation */}
      <NavigationBar />
    </View>
  );
}
