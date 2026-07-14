// Renders a legal document from its structure.
//
// The previous version parsed markdown, which is how `##` and `(초안)` ended up on a user's screen. A document
// the user is being asked to *agree to* cannot show its own scaffolding — it makes the app look like it is
// handing over a file it never read.

import { View, Text } from "react-native";
import type { Block } from "@/content/legal";

export function LegalBody({ blocks }: { blocks: Block[] }) {
  return (
    <View>
      {blocks.map((b, i) => {
        if (b.t === "chapter") {
          return (
            <Text
              key={i}
              className="text-ink"
              style={{ fontSize: 17, fontWeight: "700", marginTop: i === 0 ? 0 : 30, marginBottom: 12 }}
            >
              {b.text}
            </Text>
          );
        }

        if (b.t === "article") {
          return (
            <Text
              key={i}
              className="text-ink"
              style={{ fontSize: 15, fontWeight: "700", marginTop: 22, marginBottom: 8 }}
            >
              {b.text}
            </Text>
          );
        }

        if (b.t === "note") {
          // The things we most want actually read — set apart so they cannot be skimmed past.
          return (
            <View
              key={i}
              className="bg-group"
              style={{ borderRadius: 12, padding: 14, marginTop: 10, marginBottom: 4 }}
            >
              <Text className="text-ink" style={{ fontSize: 14, lineHeight: 23 }}>
                {b.text}
              </Text>
            </View>
          );
        }

        if (b.t === "list") {
          return (
            <View key={i} style={{ marginTop: 2, marginBottom: 6 }}>
              {b.items.map((item, j) => (
                <View key={j} className="flex-row" style={{ marginBottom: 6 }}>
                  <Text className="text-faint" style={{ fontSize: 14, lineHeight: 23, marginRight: 8 }}>
                    ·
                  </Text>
                  <Text className="text-grey" style={{ flex: 1, fontSize: 14, lineHeight: 23 }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={i} className="text-grey" style={{ fontSize: 14, lineHeight: 23, marginBottom: 8 }}>
            {b.text}
          </Text>
        );
      })}
    </View>
  );
}
