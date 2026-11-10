import "server-only";
import { Circle, Path, Svg, Text, View } from "@react-pdf/renderer";
import { HEADING_FONT, PDF_COLORS } from "./theme";

/** Same geometry as src/components/brand/Logo.tsx (Brand guide p.2). Never stretched or recoloured. */
const BUBBLE_PATH =
  "M11 2H37A9 9 0 0 1 46 11V23A9 9 0 0 1 37 32H20L11.5 39.5V32H11A9 9 0 0 1 2 23V11A9 9 0 0 1 11 2Z";

export function PdfLogoSymbol({ width, variant = "light" }: { width: number; variant?: "light" | "dark" }) {
  return (
    <Svg viewBox="0 0 48 42" width={width} height={(width * 42) / 48}>
      <Path d={BUBBLE_PATH} fill={variant === "light" ? PDF_COLORS.teal : PDF_COLORS.yellow} />
      <Circle cx="21" cy="16" r="6" fill={variant === "light" ? PDF_COLORS.yellow : PDF_COLORS.teal} />
    </Svg>
  );
}

export function PdfLogo({ size = 20, variant = "light" }: { size?: number; variant?: "light" | "dark" }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <PdfLogoSymbol width={size * 1.45} variant={variant} />
      <Text
        style={{
          marginLeft: size * 0.4,
          fontFamily: HEADING_FONT,
          fontWeight: 800,
          fontSize: size,
          color: variant === "light" ? PDF_COLORS.teal : PDF_COLORS.white,
        }}
      >
        ScamSense
      </Text>
    </View>
  );
}
