// Kakao Local — keyword place search (장소/주소 검색) and reverse-geocode (좌표 → 주소). Separate from the map
// SDK: plain REST calls to Kakao's dapi.kakao.com. Work no matter which map renders the results.
//
// **The REST key is NOT in the app (D93).** These go through our Cloudflare Worker (`kakaoProxyUrl`), which holds
// the key as a secret and relays the request to Kakao — so a publicly-distributed APK leaks no key. The query the
// user types (and the map's centre, for sorting) pass through the Worker to Kakao without being stored; nothing
// about the account is sent. Free-tier quota covers personal use.

import Constants from "expo-constants";
import type { GeoPoint } from "@/core/schedule/autoEval";

const PROXY: string =
  (Constants.expoConfig?.extra as { kakaoProxyUrl?: string } | undefined)?.kakaoProxyUrl ?? "";

/** Is search available in this build (a proxy URL is configured)? `false` → the search box is hidden. */
export const kakaoSearchAvailable = PROXY.length > 0;

export type Place = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Metres from the search centre (only when a centre was given, i.e. sorted by distance). */
  distanceM: number | null;
};

async function kakaoGet(pathAndQuery: string): Promise<any | null> {
  if (!PROXY) return null;
  try {
    const res = await fetch(`${PROXY}${pathAndQuery}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Search places by keyword. When `center` is given, results come back **nearest-first** (Kakao `sort=distance`
 * around the map's centre) with a distance — otherwise a nationwide list is unsortable noise. Returns [] on any
 * failure, so a flaky search never breaks the picker.
 */
export async function searchPlaces(query: string, center?: GeoPoint): Promise<Place[]> {
  const q = query.trim();
  if (!q || !PROXY) return [];
  let path = `/kakao/keyword?query=${encodeURIComponent(q)}&size=15`;
  if (center) path += `&x=${center.lng}&y=${center.lat}&sort=distance`;
  const data = await kakaoGet(path);
  const docs: any[] = Array.isArray(data?.documents) ? data.documents : [];
  return docs
    .map((d) => ({
      name: String(d.place_name ?? ""),
      address: String(d.road_address_name || d.address_name || ""),
      lat: parseFloat(d.y), // Kakao: y = latitude, x = longitude
      lng: parseFloat(d.x),
      distanceM: d.distance ? parseInt(d.distance, 10) : null,
    }))
    .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function shorten(region1: string): string {
  return region1
    .replace("특별자치시", "시")
    .replace("특별자치도", "도")
    .replace("특별시", "시")
    .replace("광역시", "시");
}

/**
 * Reverse-geocode a coordinate to a 3-part administrative address ("서울시 마포구 동교동") — what the map is
 * currently looking at. Prefers the 행정동 (region_type "H"). "" on any failure.
 */
export async function coordToAddress(point: GeoPoint): Promise<string> {
  if (!PROXY) return "";
  const data = await kakaoGet(`/kakao/coord2region?x=${point.lng}&y=${point.lat}`);
  const docs: any[] = Array.isArray(data?.documents) ? data.documents : [];
  const d = docs.find((x) => x.region_type === "H") ?? docs[0];
  if (!d) return "";
  const parts = [shorten(String(d.region_1depth_name ?? "")), d.region_2depth_name, d.region_3depth_name].filter(
    Boolean,
  );
  return parts.join(" ");
}

/** "350m" / "1.2km" for display. */
export function formatDistance(m: number | null): string {
  if (m == null) return "";
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}
