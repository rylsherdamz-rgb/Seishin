import { Component, type ReactNode } from "react";
import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackSubtitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary] caught:", error.message);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-white items-center justify-center px-8">
          <View className="w-16 h-16 bg-ink-100 rounded-full items-center justify-center mb-4">
            <Feather name="alert-triangle" size={28} color="#ff3b30" />
          </View>
          <Text className="text-lg font-semibold text-black text-center mb-2">
            {this.props.fallbackTitle || "Something went wrong"}
          </Text>
          <Text className="text-sm text-ink-400 text-center mb-6">
            {this.props.fallbackSubtitle || "The app encountered an unexpected error. Please restart."}
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}