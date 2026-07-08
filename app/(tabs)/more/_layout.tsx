import { Stack } from "expo-router";

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="todo" />
      <Stack.Screen name="invites" />
    </Stack>
  );
}
