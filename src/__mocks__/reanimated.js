/**
 * Minimal Reanimated stand-in for Jest. The package's own mock imports
 * react-native-worklets' native module, which can't load under Jest.
 */
const React = require("react");
const RN = require("react-native");

// Layout animations: chainable builders that do nothing.
const builder = new Proxy(function () {}, {
  get: (_t, key) => (key === "build" ? () => ({}) : () => builder),
  apply: () => builder,
});

const passthrough = (Comp) =>
  React.forwardRef(({ entering, exiting, layout, ...props }, ref) => React.createElement(Comp, { ...props, ref }));

const Animated = {
  View: passthrough(RN.View),
  Text: passthrough(RN.Text),
  ScrollView: passthrough(RN.ScrollView),
  Image: passthrough(RN.Image),
  FlatList: passthrough(RN.FlatList),
  createAnimatedComponent: passthrough,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  FadeIn: builder, FadeOut: builder, FadeInDown: builder, FadeOutUp: builder,
  ZoomIn: builder, ZoomOut: builder, SlideInDown: builder, SlideOutDown: builder,
  Layout: builder, LinearTransition: builder,
  Easing: new Proxy({}, { get: () => () => () => 0 }),
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: (fn) => fn(),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedScrollHandler: () => () => {},
  withTiming: (v) => v, withSpring: (v) => v, withDelay: (_d, v) => v,
  withRepeat: (v) => v, withSequence: (...v) => v[v.length - 1],
  cancelAnimation: () => {}, runOnJS: (fn) => fn, runOnUI: (fn) => fn,
  interpolate: () => 0, Extrapolation: { CLAMP: "clamp" },
};
