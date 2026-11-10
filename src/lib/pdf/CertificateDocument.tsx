import "server-only";
import { Circle, Document, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import { CERTIFICATE_DISCLAIMER, type CertificateView } from "@/lib/rewards/certificate";
import { PdfLogo } from "./PdfLogo";
import { BODY_FONT, HEADING_FONT, PDF_COLORS as C } from "./theme";

/**
 * ScamSense Certificate of Completion as a PDF (US Letter, landscape). Built from the same CertificateView as the
 * on-screen preview (src/components/certificate/CertificatePreview.tsx), so both always match. Used only as the
 * Zapier email attachment: there is no download route for it (R25).
 */
function Seal({ order }: { order: number }) {
  return (
    <Svg viewBox="0 0 64 64" width={58} height={58}>
      <Circle cx="32" cy="32" r="30" fill={C.white} stroke={C.teal} strokeWidth={2.5} />
      <Circle cx="32" cy="32" r="23" fill={C.yellow} stroke={C.teal} strokeWidth={2} />
      <Path
        d="M22 33 L29 40 L43 25"
        fill="none"
        stroke={C.teal}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* module order pips */}
      {[0, 1, 2].slice(0, order).map((i) => (
        <Circle key={i} cx={String(26 + i * 6)} cy="52" r="1.8" fill={C.teal} />
      ))}
    </Svg>
  );
}

export function CertificateDocument({ certificate: c }: { certificate: CertificateView }) {
  return (
    <Document
      title={`ScamSense Certificate of Completion: ${c.moduleTitle}`}
      author="ScamSense"
      subject={`Certificate ${c.certificateId}`}
      creator="ScamSense"
      producer="ScamSense"
      language="en-US"
    >
      <Page size="LETTER" orientation="landscape" style={{ backgroundColor: C.white, padding: 28 }}>
        <View
          style={{
            flex: 1,
            borderWidth: 3,
            borderColor: C.teal,
            borderRadius: 20,
            padding: 10,
          }}
        >
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: C.mist,
              borderRadius: 14,
              backgroundColor: C.white,
              paddingVertical: 30,
              paddingHorizontal: 56,
              alignItems: "center",
            }}
          >
            {/* Mist band behind the header */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 92,
                backgroundColor: C.mist,
                borderTopLeftRadius: 13,
                borderTopRightRadius: 13,
              }}
            />
            <PdfLogo size={22} />
            <Text
              style={{
                marginTop: 34,
                fontFamily: HEADING_FONT,
                fontWeight: 900,
                fontSize: 11,
                letterSpacing: 2.2,
                color: C.tealSoft,
                textTransform: "uppercase",
              }}
            >
              Scam-awareness training simulation
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontFamily: HEADING_FONT,
                fontWeight: 900,
                fontSize: 36,
                color: C.teal,
              }}
            >
              Certificate of Completion
            </Text>
            <Text style={{ marginTop: 18, fontFamily: BODY_FONT, fontSize: 12, color: C.teal }}>
              This certifies that
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontFamily: HEADING_FONT,
                fontWeight: 900,
                fontSize: c.recipientName.length > 36 ? 26 : 34,
                color: C.teal,
                textAlign: "center",
              }}
            >
              {c.recipientName}
            </Text>
            <View
              style={{ marginTop: 6, width: 220, height: 5, borderRadius: 3, backgroundColor: C.yellow }}
            />
            <Text
              style={{
                marginTop: 16,
                fontFamily: BODY_FONT,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: C.teal,
                textAlign: "center",
                maxWidth: 470,
              }}
            >
              has successfully completed the ScamSense module
            </Text>
            <Text
              style={{ marginTop: 4, fontFamily: HEADING_FONT, fontWeight: 800, fontSize: 20, color: C.teal }}
            >
              Module {c.moduleOrder}: {c.moduleTitle}
            </Text>
            <Text style={{ marginTop: 4, fontFamily: BODY_FONT, fontSize: 11.5, color: C.teal }}>
              {c.difficulty} level · {c.badgeName} badge earned
            </Text>

            {/* Details row */}
            <View
              style={{
                marginTop: "auto",
                width: "100%",
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <Detail label="Completed on" value={c.completedOn} />
              <Seal order={c.moduleOrder} />
              <Detail label="Certificate ID" value={c.certificateId} align="right" />
            </View>
            <Text
              style={{
                marginTop: 14,
                fontFamily: BODY_FONT,
                fontSize: 8,
                lineHeight: 1.4,
                color: C.tealSoft,
                textAlign: "center",
                maxWidth: 560,
              }}
            >
              {CERTIFICATE_DISCLAIMER}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function Detail({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <View style={{ width: 200, alignItems: align === "left" ? "flex-start" : "flex-end" }}>
      <Text
        style={{
          fontFamily: HEADING_FONT,
          fontWeight: 900,
          fontSize: 8.5,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: C.tealSoft,
        }}
      >
        {label}
      </Text>
      <View style={{ marginTop: 4, width: "100%", height: 1.5, backgroundColor: C.teal }} />
      <Text style={{ marginTop: 5, fontFamily: BODY_FONT, fontWeight: 600, fontSize: 12, color: C.teal }}>
        {value}
      </Text>
    </View>
  );
}
