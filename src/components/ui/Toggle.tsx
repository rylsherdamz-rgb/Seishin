import { useEffect, useRef } from "react";
import { View, TouchableOpacity, Animated, Easing, Text } from "react-native";

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
}

const SIZE_CONFIG = {
  small: { width: 36, height: 20, thumbSize: 16, padding: 2 },
  medium: { width: 48, height: 28, thumbSize: 24, padding: 2 },
  large: { width: 60, height: 34, thumbSize: 30, padding: 2 },
};

export function Toggle({
  value,
  onValueChange,
  disabled = false,
  size = "medium",
  activeColor = "#000000",
  inactiveColor = "#e5e5e5",
  thumbColor = "#ffffff",
}: ToggleProps) {
  const { width, height, thumbSize, padding } = SIZE_CONFIG[size];
  const translateX = useRef(new Animated.Value(value ? width - thumbSize - padding : padding)).current;

  // Keep the visual state in sync when the parent changes `value` itself.
  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? width - thumbSize - padding : padding,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [padding, thumbSize, translateX, value, width]);

  const animate = (toValue: boolean) => {
    Animated.timing(translateX, {
      toValue: toValue ? width - thumbSize - padding : padding,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const handlePress = () => {
    if (disabled) return;
    const newValue = !value;
    onValueChange(newValue);
    animate(newValue);
  };

  const trackColor = translateX.interpolate({
    inputRange: [padding, width - thumbSize - padding],
    outputRange: [inactiveColor, activeColor],
    extrapolate: "clamp",
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      className="flex-row items-center"
    >
      <Animated.View
        style={{
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: trackColor,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            top: padding,
            left: 0,
            width: thumbSize,
            height: thumbSize,
            borderRadius: thumbSize / 2,
            backgroundColor: thumbColor,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 3,
            elevation: 2,
            transform: [{ translateX }],
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function ToggleWithLabel({
  label,
  value,
  onValueChange,
  disabled = false,
  size = "medium",
  labelStyle,
  activeColor = "#000000",
  inactiveColor = "#e5e5e5",
}: ToggleProps & { label: string; labelStyle?: string }) {
  const labelClassName = `text-sm font-medium ${disabled ? "text-ink-400" : "text-black"} ${labelStyle || ""}`;
  return (
    <View className="flex-row items-center justify-between">
      <Text className={labelClassName}>{label}</Text>
      <Toggle
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        size={size}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
      />
    </View>
  );
}
