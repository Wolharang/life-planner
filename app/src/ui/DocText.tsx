// A reader for the policy documents.
//
// Not a general markdown engine — just enough to make a legal document *readable*, which is the only thing
// that makes consent real. A wall of undifferentiated 9pt text is how apps get agreement without comprehension.
//
// The three documents are not written the same way: the terms and the privacy policy use markdown headings
// (`#`, `##`), while the location terms are plain prose whose structure lives in the words themselves
// (`제1장 총 칙`, `제 1 조 (목적)`, `① …`). So structure is detected from both.

import { View, Text } from "react-native";

type Kind = "h1" | "h2" | "h3" | "bullet" | "rule" | "body";

interface Line {
  kind: Kind;
  text: string;
}

const CHAPTER = /^제\s*\d+\s*장/; // 제1장 총 칙
const ARTICLE = /^제\s*\d+\s*조/; // 제 1 조 (목적)

function classify(raw: string): Line | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^(-{3,}|={3,}|\*{3,})$/.test(t)) return { kind: "rule", text: "" };

  const md = /^(#{1,4})\s+(.*)$/.exec(t);
  if (md) {
    const level = md[1].length;
    return { kind: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text: md[2].trim() };
  }

  if (CHAPTER.test(t)) return { kind: "h2", text: t };
  if (ARTICLE.test(t)) return { kind: "h3", text: t };
  // The location terms open with a bare title line — no `#` anywhere in the file.
  if (/^LifePlanner .*약관$/.test(t)) return { kind: "h1", text: t };

  const bullet = /^[-*·]\s+(.*)$/.exec(t);
  if (bullet) return { kind: "bullet", text: bullet[1] };

  return { kind: "body", text: t };
}

/** `**bold**` → bold. Everything else is left alone; a policy is prose, not a document format. */
function inline(text: string, color: string, size: number, lineHeight: number) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <Text key={i} style={{ fontWeight: "700", color, fontSize: size, lineHeight }}>
        {p.slice(2, -2)}
      </Text>
    ) : (
      <Text key={i} style={{ color, fontSize: size, lineHeight }}>
        {p}
      </Text>
    )
  );
}

export function DocText({ body }: { body: string }) {
  const lines = body.split("\n").map(classify);

  return (
    <View>
      {lines.map((l, i) => {
        if (!l) return <View key={i} style={{ height: 8 }} />;

        if (l.kind === "rule") {
          return <View key={i} className="bg-group" style={{ height: 1, marginVertical: 16 }} />;
        }
        if (l.kind === "h1") {
          return (
            <Text key={i} className="text-ink" style={{ fontSize: 22, fontWeight: "700", marginBottom: 14 }}>
              {l.text}
            </Text>
          );
        }
        if (l.kind === "h2") {
          return (
            <Text
              key={i}
              className="text-ink"
              style={{ fontSize: 17, fontWeight: "700", marginTop: 22, marginBottom: 8 }}
            >
              {l.text}
            </Text>
          );
        }
        if (l.kind === "h3") {
          return (
            <Text
              key={i}
              className="text-ink"
              style={{ fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 6 }}
            >
              {l.text}
            </Text>
          );
        }
        if (l.kind === "bullet") {
          return (
            <View key={i} className="flex-row" style={{ marginBottom: 5, paddingLeft: 2 }}>
              <Text className="text-grey" style={{ fontSize: 14, lineHeight: 23, marginRight: 7 }}>
                ·
              </Text>
              <Text style={{ flex: 1 }}>{inline(l.text, "#4E5968", 14, 23)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={{ marginBottom: 6 }}>
            {inline(l.text, "#4E5968", 14, 23)}
          </Text>
        );
      })}
    </View>
  );
}
