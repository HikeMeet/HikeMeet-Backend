import React from "react";
import { View, Text, TouchableOpacity, Image, ScrollView } from "react-native";

interface PostProps {
  title: string;
  content: string;
  author: string;
  date: string;
  images: string[];
}

export default function Post({ content, author, date, images }: PostProps) {
  return (
    <View className="bg-white rounded-lg shadow-md p-4 mb-4">
      {/* Header */}
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center">
          <Image
            source={{ uri: "https://via.placeholder.com/50" }}
            className="w-10 h-10 rounded-full mr-3"
          />
          <View>
            <Text className="text-lg font-bold text-gray-800">{author}</Text>
            <Text className="text-sm text-gray-500">{date}</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Text className="text-blue-500 text-lg">✎</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Text className="text-gray-600 my-3">{content}</Text>

      {/* Images */}
      {images.length > 0 && (
        <ScrollView horizontal className="flex-row mb-3">
          {images.map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              className="w-32 h-32 mr-2 rounded-lg"
            />
          ))}
        </ScrollView>
      )}

      {/* Actions */}
      <View className="flex-row justify-between items-center">
        <View className="flex-row">
          <TouchableOpacity className="mr-3">
            <Text className="text-gray-500">💬</Text>
          </TouchableOpacity>
          <TouchableOpacity className="mr-3">
            <Text className="text-gray-500">❤️</Text>
          </TouchableOpacity>
          <TouchableOpacity className="mr-3">
            <Text className="text-gray-500">⚠️</Text>
          </TouchableOpacity>
        </View>
        <Text className="text-sm text-gray-500">{date}</Text>
      </View>
    </View>
  );
}
