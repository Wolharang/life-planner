// The 준회원/정회원 rule, guarded. `accountFromUser` derives membership from the Firebase user alone — there is no
// stored flag to drift — so these four cases ARE the model:
//   · an email signup is 준회원 (verified:false) until the link is clicked;
//   · clicking it makes them 정회원 (verified:true), which is what unlocks password reset;
//   · a Google user is 정회원 from the first moment, with nothing to verify;
//   · a malformed user object must never throw — auth glitches must not crash the account screen.

import { accountFromUser } from "./firebase";

describe("accountFromUser — 준회원/정회원", () => {
  it("an email signup is 준회원 until the link is clicked", () => {
    const a = accountFromUser({
      uid: "u1",
      email: "a@b.com",
      emailVerified: false,
      providerData: [{ providerId: "password" }],
    });
    expect(a.verified).toBe(false);
    expect(a.google).toBe(false);
  });

  it("a clicked link makes the email account 정회원", () => {
    const a = accountFromUser({
      uid: "u1",
      email: "a@b.com",
      emailVerified: true,
      providerData: [{ providerId: "password" }],
    });
    expect(a.verified).toBe(true);
    expect(a.google).toBe(false);
  });

  it("a Google account is 정회원 with nothing to click", () => {
    const a = accountFromUser({
      uid: "u2",
      email: "g@gmail.com",
      emailVerified: true,
      providerData: [{ providerId: "google.com" }],
    });
    expect(a.google).toBe(true);
    expect(a.verified).toBe(true);
  });

  it("a missing email and missing providerData never throw", () => {
    const a = accountFromUser({ uid: "u3" });
    expect(a.email).toBe(null);
    expect(a.google).toBe(false);
    expect(a.verified).toBe(false);
  });
});
