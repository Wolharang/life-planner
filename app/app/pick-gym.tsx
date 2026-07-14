// Pick a gym by MAP — pan the map, the centre pin marks the spot, no need to be standing there (founder).
//
// **Kakao Maps** (native, Korean POIs) when its key is present — free and keyless-of-billing, unlike Google Maps
// which needs a card on file. Falls back to **OpenStreetMap in a WebView** when there is no Kakao key (a fresh
// clone without kakao.json), so the picker always works. Either way a fixed centre pin marks what gets saved,
// and the map posts its centre back on every settle.

import { View, Text, Pressable, TextInput, ActivityIndicator, ScrollView, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import { WebView } from "react-native-webview";
import { addGym, listGyms } from "@/core/data/gymRepository";
import { getCurrentFix } from "@/core/geo/location";
import { KakaoMap, kakaoMapAvailable } from "@/core/geo/KakaoMap";
import { searchPlaces, coordToAddress, formatDistance, kakaoSearchAvailable, type Place } from "@/core/geo/kakaoSearch";
import { newId } from "@/core/data/id";
import type { GeoPoint } from "@/core/schedule/autoEval";

const DEFAULT: GeoPoint = { lat: 37.5665, lng: 126.978 }; // Seoul City Hall — pan from here when we have no fix
const KAKAO_KEY: string =
  (Constants.expoConfig?.extra as { kakaoNativeAppKey?: string } | undefined)?.kakaoNativeAppKey ?? "";
const USE_KAKAO = KAKAO_KEY.length > 0 && kakaoMapAvailable;

function osmHtml(center: GeoPoint): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eef}.leaflet-control-attribution{font-size:9px}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map').setView([${center.lat}, ${center.lng}], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  function post(){ var c = map.getCenter(); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ lat: c.lat, lng: c.lng })); }
  map.on('moveend', post); post();
  window.recenter = function(lat, lng){ map.setView([lat, lng], 16); };
</script></body></html>`;
}

export default function PickGym() {
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const [start, setStart] = useState<GeoPoint | null>(null); // resolved initial centre (fix or default)
  const [moveTarget, setMoveTarget] = useState<[number, number] | null>(null); // Kakao camera target (initial + recenter)
  const [center, setCenter] = useState<GeoPoint>(DEFAULT); // live picked centre (what will be saved)
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [kakaoFailed, setKakaoFailed] = useState(false); // Kakao auth (401) etc. → fall back to OSM, never a blank map

  const [query, setQuery] = useState(""); // 장소/주소 검색
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [centerAddress, setCenterAddress] = useState(""); // what the map is currently looking at (reverse-geocoded)
  const [phShowAddr, setPhShowAddr] = useState(false); // placeholder alternates: address ↔ guide text

  const useKakaoNow = USE_KAKAO && !kakaoFailed;

  // Reverse-geocode the map centre (debounced) so the placeholder can show where the map is looking.
  useEffect(() => {
    if (!kakaoSearchAvailable) return;
    const t = setTimeout(() => {
      coordToAddress(center).then((a) => a && setCenterAddress(a));
    }, 500);
    return () => clearTimeout(t);
  }, [center]);

  // Alternate the (empty-field) placeholder between the current address and the search hint.
  useEffect(() => {
    const i = setInterval(() => setPhShowAddr((v) => !v), 2600);
    return () => clearInterval(i);
  }, []);

  const placeholder = phShowAddr && centerAddress ? centerAddress : "장소, 주소 검색";

  // Move whichever map is showing — Kakao via the camera prop, OSM via injected JS. Shared by "go to me" and
  // by tapping a search result.
  const moveMapTo = (lat: number, lng: number) => {
    setCenter({ lat, lng });
    if (useKakaoNow) setMoveTarget([lat, lng]);
    else webRef.current?.injectJavaScript(`window.recenter(${lat}, ${lng}); true;`);
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearched(true);
    try {
      setResults(await searchPlaces(q, center)); // nearest-first around what the map is looking at
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (p: Place) => {
    moveMapTo(p.lat, p.lng);
    setLabel(p.name); // pre-fill the gym name with the place they chose (still editable)
    setResults([]);
    setSearched(false);
    setQuery(p.name);
  };

  // Open on the user's location when we can get one; otherwise the default. `getCurrentFix` bounds itself (a
  // fresh fix within a few seconds, else the OS's last-known), so no separate timeout is needed — and the
  // separate timeout used to be a **bug**: it captured the initial `start` (null) in its closure, so it fired
  // after 4s and overwrote the already-set current location back to the default. Set it once, here, and leave it.
  useEffect(() => {
    let done = false;
    getCurrentFix().then((fix) => {
      if (done) return;
      const c = fix ?? DEFAULT;
      setStart(c);
      setCenter(c);
      setMoveTarget([c.lat, c.lng]);
    });
    return () => {
      done = true;
    };
  }, []);

  const osm = useMemo(() => (start ? osmHtml(start) : null), [start]);

  const recenterToMe = async () => {
    const fix = await getCurrentFix();
    if (fix) moveMapTo(fix.lat, fix.lng);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const gyms = await listGyms();
      const name = label.trim() || `헬스장 ${gyms.length + 1}`;
      await addGym({ id: newId("gym"), label: name, lat: center.lat, lng: center.lng });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const ready = start != null && (!useKakaoNow || moveTarget != null);

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center" style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text className="text-ink" style={{ fontSize: 24 }}>
            ←
          </Text>
        </Pressable>
        <Text className="text-ink" style={{ fontSize: 18, fontWeight: "700", marginLeft: 12 }}>
          지도에서 헬스장 고르기
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        {!ready ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
            <Text className="text-grey" style={{ fontSize: 13, marginTop: 10 }}>
              지도를 불러오는 중…
            </Text>
          </View>
        ) : useKakaoNow ? (
          <KakaoMap
            appKey={KAKAO_KEY}
            center={moveTarget as [number, number]}
            onCenterChanged={(e) => setCenter({ lat: e.nativeEvent.lat, lng: e.nativeEvent.lng })}
            onMapError={() => setKakaoFailed(true)} // 401 / SDK error → OSM fallback, not a blank map
            style={{ flex: 1 }}
          />
        ) : (
          <WebView
            ref={webRef}
            source={{ html: osm as string }}
            onMessage={(e) => {
              try {
                const c = JSON.parse(e.nativeEvent.data);
                if (typeof c?.lat === "number" && typeof c?.lng === "number") setCenter({ lat: c.lat, lng: c.lng });
              } catch {
                /* ignore malformed */
              }
            }}
            style={{ flex: 1 }}
          />
        )}

        {/* The fixed centre pin — the map moves under it, so it always marks the spot that gets saved. */}
        {ready && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 40, marginBottom: 40 }}>📍</Text>
          </View>
        )}

        {/* Search a gym by name (Kakao Local) — tap a result and the map jumps there. Floats over the map. */}
        {ready && kakaoSearchAvailable && (
          <View style={{ position: "absolute", left: 12, right: 12, top: 12 }}>
            <View
              className="bg-surface flex-row items-center"
              style={{ borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E5E8EB" }}
            >
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={runSearch}
                returnKeyType="search"
                placeholder={placeholder}
                placeholderTextColor="#B0B8C1"
                className="text-ink"
                style={{ flex: 1, paddingVertical: 12, fontSize: 15 }}
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setResults([]);
                    setSearched(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-faint" style={{ fontSize: 16, marginRight: 8 }}>✕</Text>
                </Pressable>
              )}
              <Pressable onPress={runSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 17 }}>🔍</Text>
              </Pressable>
            </View>

            {(searching || searched) && (
              <View
                className="bg-surface"
                style={{ borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: "#E5E8EB", maxHeight: 280, overflow: "hidden" }}
              >
                {searching ? (
                  <View style={{ padding: 16, alignItems: "center" }}>
                    <ActivityIndicator />
                  </View>
                ) : results.length === 0 ? (
                  <Text className="text-grey" style={{ padding: 14, fontSize: 13 }}>
                    검색 결과가 없어요
                  </Text>
                ) : (
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {results.map((p, i) => (
                      <Pressable
                        key={i}
                        onPress={() => pickResult(p)}
                        className="flex-row items-center"
                        style={{ paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#F1F3F5" }}
                      >
                        <View className="flex-1 pr-2">
                          <Text className="text-ink" numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600" }}>
                            {p.name}
                          </Text>
                          {p.address ? (
                            <Text className="text-grey" numberOfLines={1} style={{ fontSize: 12, marginTop: 2 }}>
                              {p.address}
                            </Text>
                          ) : null}
                        </View>
                        {p.distanceM != null && (
                          <Text className="text-faint" style={{ fontSize: 12, fontWeight: "600" }}>
                            {formatDistance(p.distanceM)}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        )}

        {/* Recenter-on-me. */}
        <Pressable
          onPress={recenterToMe}
          className="bg-surface items-center justify-center"
          style={{ position: "absolute", right: 16, bottom: 16, width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: "#E5E8EB" }}
        >
          <Text style={{ fontSize: 20 }}>◎</Text>
        </Pressable>
      </View>

      <View style={{ padding: 16 }}>
        <Text className="text-grey" style={{ fontSize: 12.5, lineHeight: 18, marginBottom: 8 }}>
          지도를 움직여 가운데 핀을 헬스장에 맞춰 주세요. 위치는 이 기기에만 저장돼요.
        </Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="헬스장 이름 (선택)"
          placeholderTextColor="#B0B8C1"
          className="bg-group text-ink"
          style={{ borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 10 }}
        />
        <Pressable
          onPress={save}
          disabled={busy}
          className="bg-brand items-center"
          style={{ borderRadius: 12, paddingVertical: 15, opacity: busy ? 0.6 : 1 }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>이 위치로 지정</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
