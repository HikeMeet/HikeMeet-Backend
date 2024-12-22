import { Stack } from 'expo-router';
import { NativeWindStyleSheet } from 'nativewind';

// הגדרה ל-nativewind
NativeWindStyleSheet.setOutput({
  default: 'native',
});

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#f8f9fa' },
        headerTintColor: '#000',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    />
  );
}
