const React = require("react");
const { Text } = require("react-native");

/** Stand-in for @expo/vector-icons sets (no native font loading in Jest). */
function Icon(props) {
  return React.createElement(Text, props, "·");
}
Icon.glyphMap = {};
module.exports = { __esModule: true, default: Icon };
