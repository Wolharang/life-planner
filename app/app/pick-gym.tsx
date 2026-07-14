// Pick a gym by MAP — pan the map, the centre pin marks the spot, no need to be standing there (founder).
//
// **Kakao Maps** (native, Korean POIs) when its key is present — free and keyless-of-billing, unlike Google Maps
// which needs a card on file. Falls back to **OpenStreetMap in a WebView** when there is no Kakao key (a fresh
// clone without kakao.json), so the picker always works. Either way a fixed centre pin marks what gets saved,
// and the map posts its centre back on every settle.

import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import { WebView } from "react-native-webview";
import { addGym, listGyms } from "@/core/data/gymRepository";
import { getCurrentFix } from "@/core/geo/location";
import { KakaoMap, kakaoMapAvailable } from "@/core/geo/KakaoMap";
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

  const useKakaoNow = USE_KAKAO && !kakaoFailed;

  // Start on the user's location when we can get one; otherwise the default. Never blocks — a fix that never
  // arrives just leaves the map on the fallback, which the user pans from.
  useEffect(() => {
    let done = false;
    const apply = (c: GeoPoint) => {
      if (done) return;
      setStart(c);
      setCenter(c);
      setMoveTarget([c.lat, c.lng]);
    };
    getCurrentFix().then((fix) => apply(fix ?? DEFAULT));
    const t = setTimeout(() => {
      if (!done && start == null) apply(DEFAULT);
    }, 4000);
    return () => {
      done = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const osm = useMemo(() => (start ? osmHtml(start) : null), [start]);

  const recenterToMe = async () => {
    const fix = await getCurrentFix();
    if (!fix) return;
    if (useKakaoNow) setMoveTarget([fix.lat, fix.lng]);
    else webRef.current?.injectJavaScript(`window.recenter(${fix.lat}, ${fix.lng}); true;`);
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
