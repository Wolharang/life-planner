// Touch feedback (reference-apps §A7 · tech-feasibility §1.3). `expo-haptics` shipped in the stack and was
// **never imported once** — every save, delete and log landed in silence.
//
// It matters more here than in an ordinary app: this product is used **in the moment**, one-handed, without
// looking — at a convenience-store till, walking out of a lecture. A tap that answers back is a tap you don't
// have to verify with your eyes, and that is a direct S4 (logging friction) win.
//
// Never used to punish: there is no "error" buzz on a miss. A miss is neutral data (R14).

import * as Haptics from "expo-haptics";

const safe = (run: () => Promise<unknown>) => {
  void run().catch(() => {
    // a device with no haptic motor, or a policy that refuses — feedback is a courtesy, never a requirement
  });
};

/** A record was created or updated. */
export const hapticSaved = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** A record was destroyed. Warning = "that was irreversible", not "you did wrong". */
export const hapticDeleted = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

/** A light tick for a choice that changes state (a chip, a toggle). */
export const hapticTap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
