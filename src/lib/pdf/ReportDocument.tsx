import "server-only";
import type { ReactNode } from "react";
import { Circle, Document, Link, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import {
  REPORT_DISCLAIMER,
  REPORT_FUNDS_NOTICE,
  type ModuleReport,
  type ReportEvidence,
  type ReportScenario,
} from "@/lib/report/build";
import { PdfLogo } from "./PdfLogo";
import { BODY_FONT, HEADING_FONT, PDF_COLORS as C } from "./theme";

/**
 * Module analysis report PDF (US Letter portrait). Data comes only from `ModuleReport` (stored results); this file
 * only lays it out. Meaning is always carried by words, never by colour alone.
 */

const KIND_LABEL: Record<string, string> = {
  red_flag: "Red flag",
  worth_verifying: "Worth verifying",
  positive_verification_evidence: "Positive verification",
};

const s = {
  body: { fontFamily: BODY_FONT, fontSize: 9.5, lineHeight: 1.45, color: C.teal },
  small: { fontFamily: BODY_FONT, fontSize: 8.5, lineHeight: 1.4, color: C.tealSoft },
  h2: { fontFamily: HEADING_FONT, fontWeight: 800, fontSize: 15, color: C.teal },
  h3: { fontFamily: HEADING_FONT, fontWeight: 800, fontSize: 11, color: C.teal },
  eyebrow: {
    fontFamily: HEADING_FONT,
    fontWeight: 900,
    fontSize: 7.5,
    letterSpacing: 1.1,
    textTransform: "uppercase" as const,
    color: C.tealSoft,
  },
};

function Tick() {
  return (
    <Svg viewBox="0 0 12 12" width={9} height={9}>
      <Path d="M2.5 6.5 L5 9 L9.5 3.5" stroke={C.teal} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Ring() {
  return (
    <Svg viewBox="0 0 12 12" width={9} height={9}>
      <Circle cx="6" cy="6" r="4" stroke={C.teal} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}

function Dot() {
  return (
    <Svg viewBox="0 0 12 12" width={9} height={9}>
      <Circle cx="6" cy="6" r="2.2" fill={C.teal} />
    </Svg>
  );
}

function Flag() {
  return (
    <Svg viewBox="0 0 12 12" width={9} height={9}>
      <Path d="M3 11 V2 H9 L7.5 4.5 L9 7 H3" stroke={C.teal} strokeWidth={1.2} fill={C.yellow} />
    </Svg>
  );
}

function Section({ title, children, wrap = true }: { title: string; children: ReactNode; wrap?: boolean }) {
  return (
    <View style={{ marginTop: 16 }} wrap={wrap}>
      <Text style={s.h2} minPresenceAhead={60}>
        {title}
      </Text>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

function Card({ children, tone = "mist" }: { children: ReactNode; tone?: "mist" | "white" | "tint" }) {
  return (
    <View
      style={{
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: C.teal,
        backgroundColor: tone === "mist" ? C.mist : tone === "tint" ? C.yellowTint : C.white,
        padding: 10,
      }}
    >
      {children}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, marginHorizontal: 4 }}>
      <Card>
        <Text style={s.eyebrow}>{label}</Text>
        <Text
          style={{ marginTop: 3, fontFamily: HEADING_FONT, fontWeight: 900, fontSize: 16, color: C.teal }}
        >
          {value}
        </Text>
        {sub ? <Text style={{ ...s.small, marginTop: 1 }}>{sub}</Text> : null}
      </Card>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: C.mist,
      }}
    >
      <Text style={s.body}>{label}</Text>
      <Text style={{ ...s.body, fontWeight: 600 }}>{value}</Text>
    </View>
  );
}

function Bullets({ items, icon }: { items: string[]; icon?: ReactNode }) {
  return (
    <View>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: 2 }} wrap={false}>
          <View style={{ width: 12, paddingTop: 2.5 }}>{icon ?? <Dot />}</View>
          <Text style={{ ...s.body, flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function EvidenceList({ items, empty }: { items: ReportEvidence[]; empty: string }) {
  if (items.length === 0) return <Text style={s.small}>{empty}</Text>;
  return (
    <View>
      {items.map((e, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: 2 }} wrap={false}>
          <View style={{ width: 12, paddingTop: 2.5 }}>{e.kind === "red_flag" ? <Flag /> : <Dot />}</View>
          <Text style={{ ...s.body, flex: 1 }}>
            {e.title}
            <Text style={s.small}>
              {"  "}({KIND_LABEL[e.kind] ?? "Evidence"}
              {e.important ? ", important" : ""})
            </Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 9 }}>
      <Text style={s.h3} minPresenceAhead={30}>
        {title}
      </Text>
      <View style={{ marginTop: 3 }}>{children}</View>
    </View>
  );
}

function ScenarioSection({ sc }: { sc: ReportScenario }) {
  return (
    <View style={{ marginTop: 4 }} break>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottomWidth: 2,
          borderBottomColor: C.teal,
          paddingBottom: 5,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>
            Scenario {sc.position}
            {sc.completedOn ? ` · completed ${sc.completedOn}` : ""}
          </Text>
          <Text style={{ ...s.h2, fontSize: 16 }}>{sc.title}</Text>
        </View>
        <Text style={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: 16, color: C.teal }}>
          {sc.score ? `${sc.score.total} / ${sc.score.max}` : "Score unavailable"}
        </Text>
      </View>

      {!sc.feedbackAvailable ? (
        <View style={{ marginTop: 8 }}>
          <Card tone="tint">
            <Text style={s.body}>
              The saved feedback for this scenario couldn&apos;t be read when this report was generated. Your
              official score and Training Funds are unaffected. Try downloading the report again later.
            </Text>
          </Card>
        </View>
      ) : null}

      {sc.score ? (
        <View style={{ flexDirection: "row", marginTop: 8, marginHorizontal: -4 }}>
          <Stat label="Decision" value={`${sc.score.decision}/40`} />
          <Stat label="Reasoning" value={`${sc.score.reasoning}/30`} />
          <Stat label="Verification" value={`${sc.score.verification}/20`} />
          <Stat label="Payment safety" value={`${sc.score.paymentSafety}/10`} />
        </View>
      ) : null}

      {sc.decision ? (
        <Sub title="Your recorded decision">
          <Text style={s.body}>
            <Text style={{ fontWeight: 600 }}>{sc.decision.summary}</Text>
            {sc.decision.appropriate === null
              ? ""
              : sc.decision.appropriate
                ? "  (matched the evidence)"
                : "  (worth another look)"}
          </Text>
          {sc.decision.outcome ? (
            <Text style={{ ...s.small, marginTop: 2 }}>{sc.decision.outcome}</Text>
          ) : null}
        </Sub>
      ) : null}

      {sc.justificationExcerpt ? (
        <Sub title="Your written explanation (excerpt)">
          <View style={{ borderLeftWidth: 3, borderLeftColor: C.yellow, paddingLeft: 8 }}>
            <Text style={{ ...s.body, fontStyle: "normal" }}>&ldquo;{sc.justificationExcerpt}&rdquo;</Text>
          </View>
          {sc.reasoningSummary ? (
            <Text style={{ ...s.body, marginTop: 5 }}>
              <Text style={{ fontWeight: 600 }}>Feedback summary: </Text>
              {sc.reasoningSummary}
            </Text>
          ) : null}
        </Sub>
      ) : null}

      {sc.feedbackAvailable ? (
        <>
          <Sub title="Evidence you correctly identified">
            <EvidenceList
              items={sc.recognized}
              empty="None of the key evidence was mentioned in your explanation."
            />
          </Sub>
          <Sub title="Important evidence you missed">
            <EvidenceList items={sc.missed} empty="You didn't miss any of the key evidence. Nice work." />
          </Sub>
          <Sub title="Unsupported assumptions">
            {sc.unsupportedAssumptions.length ? (
              <Bullets items={sc.unsupportedAssumptions} />
            ) : (
              <Text style={s.small}>No unsupported assumptions were noted.</Text>
            )}
          </Sub>
        </>
      ) : null}

      <Sub title="Verification actions">
        {sc.verificationPerformed.length ? (
          <Bullets items={sc.verificationPerformed.map((a) => `${a} (done)`)} icon={<Tick />} />
        ) : (
          <Text style={s.small}>No verification actions were recorded.</Text>
        )}
        {sc.verificationMissed.length ? (
          <View style={{ marginTop: 3 }}>
            <Text style={s.small}>Checks you could also have made:</Text>
            <Bullets items={sc.verificationMissed} icon={<Ring />} />
          </View>
        ) : null}
        {sc.verificationFeedback ? (
          <Text style={{ ...s.body, marginTop: 4 }}>{sc.verificationFeedback}</Text>
        ) : null}
      </Sub>

      <Sub title="Training Funds in this scenario">
        <Text style={s.body}>
          {sc.payment
            ? `${sc.payment.amountText} paid with fictional Training Funds: ${
                sc.payment.meaning === "fraud_loss"
                  ? "lost to the scam in the story."
                  : sc.payment.meaning === "spending"
                    ? "a legitimate purchase (ordinary spending)."
                    : "recorded."
              }`
            : "No payment was made in this scenario."}
        </Text>
      </Sub>

      {sc.improvement || sc.takeaway ? (
        <View style={{ marginTop: 10 }} wrap={false}>
          <Card tone="white">
            {sc.improvement ? (
              <Text style={s.body}>
                <Text style={{ fontWeight: 700 }}>To improve next time: </Text>
                {sc.improvement}
              </Text>
            ) : null}
            {sc.takeaway ? (
              <Text style={{ ...s.body, marginTop: sc.improvement ? 4 : 0 }}>
                <Text style={{ fontWeight: 700 }}>Takeaway: </Text>
                {sc.takeaway}
              </Text>
            ) : null}
          </Card>
        </View>
      ) : null}
      {sc.feedbackSource === "fallback" ? (
        <Text style={{ ...s.small, marginTop: 4 }}>
          Feedback for this scenario is ScamSense&apos;s basic feedback (authored explanations and keyword
          matching).
        </Text>
      ) : null}
    </View>
  );
}

export function ReportDocument({ report: r }: { report: ModuleReport }) {
  return (
    <Document
      title={`ScamSense analysis report: Module ${r.module.order}, ${r.module.title}`}
      author="ScamSense"
      subject="Module analysis report"
      creator="ScamSense"
      producer="ScamSense"
      language="en-US"
    >
      <Page
        size="LETTER"
        style={{ paddingTop: 36, paddingBottom: 54, paddingHorizontal: 44, backgroundColor: C.white }}
      >
        {/* Header band */}
        <View
          style={{
            backgroundColor: C.teal,
            borderRadius: 14,
            paddingVertical: 16,
            paddingHorizontal: 18,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <PdfLogo size={18} variant="dark" />
          <Text
            style={{
              fontFamily: HEADING_FONT,
              fontWeight: 900,
              fontSize: 10,
              letterSpacing: 1.4,
              color: C.white,
            }}
          >
            MODULE ANALYSIS REPORT
          </Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={s.eyebrow}>
            Module {r.module.order} · {r.module.difficulty}
          </Text>
          <Text style={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: 24, color: C.teal }}>
            {r.module.title}
          </Text>
          <Text style={{ ...s.body, marginTop: 2 }}>
            Prepared for <Text style={{ fontWeight: 700 }}>{r.learnerName}</Text> · Completed {r.completedOn}
            {r.certificateId ? ` · Certificate ID ${r.certificateId}` : ""}
          </Text>
          <Text style={s.small}>
            Generated {r.generatedOn} from your saved results. Practice replays are not included.
          </Text>
        </View>

        <View style={{ flexDirection: "row", marginTop: 12, marginHorizontal: -4 }}>
          <Stat
            label="Module score"
            value={`${r.score.points} / ${r.score.max}`}
            sub={`${r.score.scoredScenarios} of 2 scenarios scored`}
          />
          <Stat label="Badge earned" value={r.module.badgeName} sub="ScamSense learning badge" />
          <Stat
            label="Training Funds (fictional)"
            value={r.funds ? r.funds.ending : "Unavailable"}
            sub={r.funds ? `left of ${r.funds.starting}` : undefined}
          />
        </View>

        <Section title="Scenario scores" wrap={false}>
          {r.scenarios.map((sc) => (
            <Row
              key={sc.scenarioKey}
              label={`Scenario ${sc.position}: ${sc.title}`}
              value={sc.score ? `${sc.score.total} / ${sc.score.max}` : "Unavailable"}
            />
          ))}
          <Row label="Module total" value={`${r.score.points} / ${r.score.max}`} />
        </Section>

        <Section title="Training Funds summary" wrap={false}>
          {r.funds ? (
            <>
              <Row label="Starting balance" value={r.funds.starting} />
              <Row label="Ending balance" value={r.funds.ending} />
              <Row label="Legitimate spending" value={r.funds.spending} />
              <Row label="Lost to scams (in the story)" value={r.funds.fraudLoss} />
              <Row label="Payments made" value={String(r.funds.paymentCount)} />
            </>
          ) : (
            <Text style={s.body}>
              The Training Funds ledger couldn&apos;t be read when this report was generated.
            </Text>
          )}
          <View style={{ marginTop: 8 }}>
            <Card tone="tint">
              <Text style={s.body}>{REPORT_FUNDS_NOTICE}</Text>
            </Card>
          </View>
        </Section>

        {r.scenarios.map((sc) => (
          <ScenarioSection key={sc.scenarioKey} sc={sc} />
        ))}

        <Section title="Key lessons from this module" wrap={false}>
          <Bullets items={r.keyLessons} icon={<Tick />} />
        </Section>

        {r.references.length ? (
          <Section title="Official educational references">
            {r.references.map((ref, i) => (
              <View key={i} style={{ marginTop: 4 }} wrap={false}>
                <Text style={s.body}>
                  <Text style={{ fontWeight: 600 }}>{ref.title}</Text> · {ref.publisher}
                </Text>
                <Link src={ref.url} style={{ ...s.small, color: C.teal, textDecoration: "underline" }}>
                  {ref.url}
                </Link>
                {ref.note ? <Text style={s.small}>{ref.note}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        <View style={{ marginTop: 18 }} wrap={false}>
          <Text style={s.small}>{REPORT_DISCLAIMER}</Text>
          <Text style={{ ...s.small, marginTop: 4 }}>ScamSense: Pause. Check. Verify. Then Pay.</Text>
        </View>
        {/* Footer on every page (absolute + fixed, last child so it paints over nothing) */}
        <Text fixed style={{ ...s.small, position: "absolute", bottom: 24, left: 44 }}>
          ScamSense · Module {r.module.order} analysis report · {r.learnerName}
        </Text>
        {/* Dynamic text: one font family and no fixed width (react-pdf 4.9 drops it otherwise; only digits here). */}
        <Text
          fixed
          style={{
            fontFamily: "Inter",
            fontSize: 8.5,
            color: C.tealSoft,
            position: "absolute",
            bottom: 24,
            right: 44,
          }}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
