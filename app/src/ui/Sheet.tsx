// A bottom sheet — the app's own way of asking before something irreversible.
//
// It replaces `Alert.alert`, which is the OS's dialog from another decade: a grey box, buttons in whatever
// order the platform likes, no room to say what will actually happen. For a question like *"delete everything,
// on every device, forever?"* the answer depends entirely on the user having understood it — and a stacked
// list of one-word buttons is the format least likely to be read.
//
// So: one row per outcome, each **saying what it does**, with the destructive one marked. Nothing here is
// alarm-red — `warn` (#B5533C) is the muted system-error tone (design-system: a miss is taupe and never red;
// red is not the app's voice even when the action is grave).

import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";

export interface SheetAction {
  label: string;
  /** What this option actually does. The reason the sheet exists instead of a two-button dialog. */
  desc?: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  actions: SheetAction[];
  /** Defaults to 취소. */
  cancelLabel?: string;
  onClose: () => void;
}

export function Sheet({ visible, title, message, actions, cancelLabel = "취소", onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(25,31,40,0.4)", justifyContent: "flex-end" }}
      >
        {/* Stop a touch on the sheet itself from dismissing it. */}
        <Pressable
          onPress={() => {}}
          className="bg-surface"
          style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28 }}
        >
          <View className="items-center" style={{ paddingTop: 10, paddingBottom: 6 }}>
            <View className="bg-off" style={{ width: 36, height: 4, borderRadius: 999 }} />
          </View>

          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <Text className="text-ink" style={{ fontSize: 19, fontWeight: "700" }}>
              {title}
            </Text>
            {message ? (
              <Text className="text-grey" style={{ fontSize: 13.5, lineHeight: 21, marginTop: 8 }}>
                {message}
              </Text>
            ) : null}

            <View style={{ marginTop: 18 }}>
              {actions.map((a, i) => (
                <Pressable
                  key={i}
                  onPress={a.onPress}
                  disabled={a.disabled}
                  className="bg-group"
                  style={{
                    borderRadius: 14,
                    paddingVertical: 15,
                    paddingHorizontal: 16,
                    marginBottom: 8,
                    opacity: a.disabled ? 0.45 : 1,
                  }}
                >
                  <Text
                    className={a.danger ? "text-warn" : "text-ink"}
                    style={{ fontSize: 15.5, fontWeight: "700" }}
                  >
                    {a.label}
                  </Text>
                  {a.desc ? (
                    <Text className="text-grey" style={{ fontSize: 12.5, lineHeight: 19, marginTop: 3 }}>
                      {a.desc}
                    </Text>
                  ) : null}
                </Pressable>
              ))}

              <Pressable
                onPress={onClose}
                className="items-center"
                style={{ borderRadius: 14, paddingVertical: 15, marginTop: 4 }}
              >
                <Text className="text-grey" style={{ fontSize: 15, fontWeight: "600" }}>
                  {cancelLabel}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** The quiet confirmation when a thing cannot be undone — a clean bottom sheet with a two-button row (취소 ·
 *  the destructive action), not a stacked list. `warn` (#B5533C) is the muted system tone, never alarm-red. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(25,31,40,0.4)", justifyContent: "flex-end" }}>
        <Pressable style={{ ...StyleSheet.absoluteFillObject }} onPress={onClose} />
        <View className="bg-surface" style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 26 }}>
          <View className="items-center" style={{ paddingTop: 10, paddingBottom: 6 }}>
            <View className="bg-off" style={{ width: 36, height: 4, borderRadius: 999 }} />
          </View>
          <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
            <Text className="text-ink" style={{ fontSize: 19, fontWeight: "700" }}>
              {title}
            </Text>
            {message ? (
              <Text className="text-grey" style={{ fontSize: 13.5, lineHeight: 21, marginTop: 8 }}>
                {message}
              </Text>
            ) : null}
            <View className="flex-row" style={{ gap: 10, marginTop: 22 }}>
              <Pressable
                onPress={onClose}
                className="bg-group flex-1 items-center"
                style={{ borderRadius: 14, paddingVertical: 15 }}
              >
                <Text className="text-ink-soft" style={{ fontSize: 15.5, fontWeight: "700" }}>
                  취소
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={busy}
                className="flex-1 items-center"
                style={{ borderRadius: 14, paddingVertical: 15, backgroundColor: "#B5533C", opacity: busy ? 0.5 : 1 }}
              >
                <Text className="text-white" style={{ fontSize: 15.5, fontWeight: "700" }}>
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
