// The auto-evaluation decision, pinned. This is the correctness heart of the GPS feature — every branch of the
// founder's rule (moved → 성공; stayed → 실패; stayed at a gym → 성공; too few fixes → abstain) is here.

import { evaluateByLocation, distanceM, atGym, DEFAULT_RADIUS_M } from "./autoEval";

// A real, checkable distance: Seoul City Hall → Gangnam Station is ~8 km.
const cityHall = { lat: 37.5663, lng: 126.9779 };
const gangnam = { lat: 37.4979, lng: 127.0276 };

// Three points all inside one building (metres apart).
const home = { lat: 37.5665, lng: 126.978 };
const homeJitter1 = { lat: 37.5666, lng: 126.9781 }; // ~15 m away — GPS noise, not movement
const homeJitter2 = { lat: 37.5664, lng: 126.9779 };

describe("distanceM", () => {
  it("is ~8 km between City Hall and Gangnam, and ~0 for a point to itself", () => {
    const km = distanceM(cityHall, gangnam) / 1000;
    expect(km > 7 && km < 9).toBe(true);
    expect(distanceM(home, home)).toBe(0);
  });
});

describe("evaluateByLocation — the founder's rule", () => {
  it("moved → 성공 (any fix beyond the radius from the others)", () => {
    expect(evaluateByLocation([home, gangnam, cityHall])).toBe("success");
  });

  it("stayed put, no gym → 실패", () => {
    expect(evaluateByLocation([home, homeJitter1, homeJitter2], [])).toBe("fail");
  });

  it("stayed put, but AT a saved gym → 성공", () => {
    const gyms = [{ id: "g1", label: "내 헬스장", lat: 37.5665, lng: 126.978 }];
    expect(evaluateByLocation([home, homeJitter1, homeJitter2], gyms)).toBe("success");
  });

  it("stayed put, and the only gym is far away → 실패", () => {
    const gyms = [{ id: "g1", label: "먼 헬스장", lat: 37.4979, lng: 127.0276 }];
    expect(evaluateByLocation([home, homeJitter1, homeJitter2], gyms)).toBe("fail");
  });

  it("GPS jitter inside the radius does not read as movement", () => {
    expect(distanceM(home, homeJitter1) < DEFAULT_RADIUS_M).toBe(true);
    expect(evaluateByLocation([home, homeJitter1], [])).toBe("fail");
  });

  it("fewer than two fixes → abstain (null), never a guessed verdict", () => {
    expect(evaluateByLocation([home], [])).toBe(null);
    expect(evaluateByLocation([], [])).toBe(null);
  });
});

describe("atGym", () => {
  it("is true within range of any gym and false otherwise", () => {
    const gyms = [{ lat: 37.5665, lng: 126.978 }];
    expect(atGym(home, gyms)).toBe(true);
    expect(atGym(gangnam, gyms)).toBe(false);
  });
});
