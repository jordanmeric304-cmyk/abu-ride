import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
      <Stack.Screen name="ticket" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="driver" />
      <Stack.Screen name="driver-tools" />
      <Stack.Screen name="scanner" />
      <Stack.Screen name="driver-history" />
      <Stack.Screen name="driver-earnings" />
      <Stack.Screen name="driver-profile" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="profile" />
      <Stack.Screen
  name="admin-funding-requests"
  options={{
    headerShown: false,
  }}
/>
    </Stack>
  );
}