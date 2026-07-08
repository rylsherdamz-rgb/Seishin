import Svg, { Path, Circle, Ellipse, G } from "react-native-svg";

interface LogoProps {
  size?: number;
}

export function Logo({ size = 120 }: LogoProps) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 120 120" fill="none">
      {/* Ears */}
      <Path d="M30 55 L20 20 L48 40Z" fill="#000000" />
      <Path d="M90 55 L100 20 L72 40Z" fill="#000000" />
      {/* Inner ears */}
      <Path d="M32 50 L25 28 L45 42Z" fill="#ffffff" />
      <Path d="M88 50 L95 28 L75 42Z" fill="#ffffff" />

      {/* Head */}
      <Ellipse cx="60" cy="62" rx="34" ry="30" fill="#000000" />

      {/* Face mask */}
      <Ellipse cx="60" cy="65" rx="24" ry="20" fill="#ffffff" />

      {/* Tabby M stripe on forehead */}
      <Path d="M45 50 L50 58 L55 50 L60 58 L65 50 L70 58 L75 50" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Vertical forehead stripes */}
      <Path d="M52 48 L52 56" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
      <Path d="M60 46 L60 56" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
      <Path d="M68 48 L68 56" stroke="#000000" strokeWidth="2" strokeLinecap="round" />

      {/* Eyes */}
      <Circle cx="50" cy="62" r="3.5" fill="#000000" />
      <Circle cx="70" cy="62" r="3.5" fill="#000000" />
      {/* Eye shine */}
      <Circle cx="49" cy="60.5" r="1" fill="#ffffff" />
      <Circle cx="69" cy="60.5" r="1" fill="#ffffff" />

      {/* Nose */}
      <Path d="M58 68 L60 70 L62 68Z" fill="#000000" />

      {/* Mouth */}
      <Path d="M60 70 L55 74" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M60 70 L65 74" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />

      {/* Whiskers */}
      <Path d="M35 66 L48 68" stroke="#000000" strokeWidth="1" strokeLinecap="round" />
      <Path d="M35 70 L48 70" stroke="#000000" strokeWidth="1" strokeLinecap="round" />
      <Path d="M35 74 L48 72" stroke="#000000" strokeWidth="1" strokeLinecap="round" />
      <Path d="M85 66 L72 68" stroke="#000000" strokeWidth="1" strokeLinecap="round" />
      <Path d="M85 70 L72 70" stroke="#000000" strokeWidth="1" strokeLinecap="round" />
      <Path d="M85 74 L72 72" stroke="#000000" strokeWidth="1" strokeLinecap="round" />

      {/* Cheek stripes (tabby markings) */}
      <Path d="M44 74 L40 78" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M76 74 L80 78" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
