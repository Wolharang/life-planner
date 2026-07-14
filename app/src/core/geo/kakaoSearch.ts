// Kakao Local — keyword place search (헬스장 이름으로 검색). Separate from the map SDK: a plain REST call to
// dapi.kakao.com with the REST key, returning places with coordinates. Works no matter which map renders them.
//
// The query the user types goes to Kakao; nothing about the account does. Free-tier quota covers personal use.

import Constants from "expo-constants";

const REST_KEY: string =
  (Constants.expoConfig?.extra as { kakaoRestApiKey?: string } | undefined)?.kakaoRestApiKey ?? "";

/** Is search available in this build (a REST key is present)? `false` → the search box is hidden. */
export const kakaoSearchAvailable = REST_KEY.length > 0;

export type Place = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

/**
 * Search places by keyword. Returns [] on any failure (no key, network, non-OK, malformed) — the caller just
 * shows "결과 없음" rather than an error, so a flaky search never breaks the picker.
 */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (!q || !REST_KEY) return [];
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=15`,
      { headers: { Authorization: `KakaoAK ${REST_KEY}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const docs: any[] = Array.isArray(data?.documents) ? data.documents : [];
    return docs
      .map((d) => ({
        name: String(d.place_name ?? ""),
        address: String(d.road_address_name || d.address_name || ""),
        lat: parseFloat(d.y), // Kakao: y = latitude, x = longitude
        lng: parseFloat(d.x),
      }))
      .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  } catch {
    return [];
  }
}
