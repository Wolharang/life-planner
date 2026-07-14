// Pick a gym by MAP — pan the map, the centre pin marks the spot, no need to be standing there (founder).
//
// **Why OpenStreetMap in a WebView, not Google Maps:** Google Maps (react-native-maps with the Google provider,
// or the Maps SDK) needs an API key backed by a **billing account** — a card on file — which breaks the app's
// free-only / no-card rule. OSM tiles + Leaflet are free and keyless. The map is a tiny self-contained HTML page
// driven over a WebView bridge; it posts the map centre back to RN on every pan, and the RN button below saves it.
//
// Needs a network connection to load the tiles and Leaflet (a map is inherently online); offline, the page is
// blank and the user falls back to "현재 위치로 추가". Low-volume personal use is within OSM's tile policy.

import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { addGym, listGyms } from "@/core/data/gymRepository";
import { getCurrentFix } from "@/core/geo/location";
import { newId } from "@/core/data/id";
import type { GeoPoint } from "@/core/schedule/autoEval";

// A sensible fallback when we have no location fix (Seoul City Hall) — the user just pans from here.
const DEFAULT: GeoPoint = { lat: 37.5665, lng: 126.978 };

function mapHtml(center: GeoPoint): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0;padding:0;background:#eef}
  .pin{position:fixed;left:50%;top:50%;transform:translate(-50%,-100%);font-size:40px;z-index:1000;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.3)}
  .leaflet-control-attribution{font-size:9px}
</style></head><body>
<div id="map"></div>
<div class="pin">📍</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${center.lat}, ${center.lng}], 16);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  function post(){ var c = map.getCenter(); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ lat: c.lat, lng: c.lng })); }
  map.on('moveend', post);
  post();
  // Let RN recentre on the user's location.
  window.recenter = function(lat, lng){ map.setView([lat, lng], 16); };
</script></body></html>`;
}

export default function PickGym() {
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const [start, setStart] = useState<GeoPoint | null>(null); // resolved initial centre (fix or default)
  const [center, setCenter] = useState<GeoPoint>(DEFAULT); // live map centre (what will be saved)
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  // Start on the user's location if we can get one; otherwise the default. Never blocks — a fix that never
  // arrives just leaves the map on the fallback, which the user pans from.
  useEffect(() => {
    let done = false;
    getCurrentFix().then((fix) => {
      if (done) return;
      const c = fix ?? DEFAULT;
      setStart(c);
      setCenter(c);
    });
    // Safety: if the fix hangs, show the default map rather than a spinner forever.
    const t = setTimeout(() => {
      if (!done) setStart((s) => s ?? DEFAULT);
    }, 4000);
    return () => {
      done = true;
      clearTimeout(t);
    };
  }, []);

  const html = useMemo(() => (start ? mapHtml(start) : null), [start]);

  const recenterToMe = async () => {
    const fix = await getCurrentFix();
    if (fix) webRef.current?.injectJavaScript(`window.recenter(${fix.lat}, ${fix.lng}); true;`);
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
        {html ? (
          <WebView
            ref={webRef}
            source={{ html }}
            onMessage={(e) => {
              try {
                const c = JSON.parse(e.nativeEvent.data);
                if (typeof c?.lat === "number" && typeof c?.lng === "number") setCenter({ lat: c.lat, lng: c.lng });
              } catch {
                /* ignore malformed */
              }
            }}
            geolocationEnabled
            style={{ flex: 1 }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
            <Text className="text-grey" style={{ fontSize: 13, marginTop: 10 }}>
              지도를 불러오는 중…
            </Text>
          </View>
        )}
        {/* Recenter-on-me button, floating over the map. */}
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
