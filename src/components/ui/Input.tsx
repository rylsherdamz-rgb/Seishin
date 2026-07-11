import { useState } from "react";
import { View, TextInput, Text } from "react-native";

type InputVariant = "filled" | "underline";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  variant?: InputVariant;
  error?: string;
  keyboardType?: "default" | "email-address" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  className?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  variant = "filled",
  error,
  keyboardType = "default",
  autoCapitalize,
  className = "",
}: InputProps) {
  const [focused, setFocused] = useState(false);

  const base =
    variant === "filled"
      ? `bg-ink-50 rounded-xl px-4 ${
          focused ? "border border-black" : "border border-transparent"
        }`
      : `border-b px-0 ${focused ? "border-black" : "border-ink-200"}`;

  const errorBorder = error
    ? variant === "filled"
      ? "border border-danger"
      : "border-danger"
    : "";

  return (
    <View className={`mb-4 ${className}`}>
      {label && (
        <Text className="text-xs font-medium text-ink-500 mb-1.5">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor="#999999"
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        className={`text-base text-black ${base} ${errorBorder} ${
          multiline ? "min-h-[80px] py-3" : "h-12"
        }`}
      />
      {error && <Text className="text-xs text-danger mt-1">{error}</Text>}
    </View>
  );
}
