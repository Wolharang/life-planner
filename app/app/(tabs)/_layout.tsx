// Bottom tab bar (full app IA): 홈 · 캘린더 · 기록. v5 skin — active = brand blue, inactive = grey,
// white bar with a hairline top border. Non-tab screens (add, execution, settings, onboarding, metrics,
// add-event) live at the app/app/ root and are pushed over the tabs by the root Stack.

import { Tabs } from "expo-router";
import Svg, { Path, Rect, Line } from "react-native-svg";

const ACTIVE = "#3182F6"; // brand
const INACTIVE = "#8B95A1"; // grey

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11.5 12 4l8 7.5M6 10v9h12v-9"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={15} rx={3} stroke={color} strokeWidth={1.9} />
      <Line x1={4} y1={9.5} x2={20} y2={9.5} stroke={color} strokeWidth={1.9} />
      <Line x1={8} y1={3.5} x2={8} y2={6.5} stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={16} y1={3.5} x2={16} y2={6.5} stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

function LogsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Line x1={9} y1={7} x2={20} y2={7} stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={9} y1={12} x2={20} y2={12} stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Line x1={9} y1={17} x2={20} y2={17} stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Path d="M4 7h.01M4 12h.01M4 17h.01" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F2F4F6",
          borderTopWidth: 1,
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "홈", tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: "캘린더", tabBarIcon: ({ color }) => <CalendarIcon color={color} /> }}
      />
      <Tabs.Screen
        name="logs"
        options={{ title: "기록", tabBarIcon: ({ color }) => <LogsIcon color={color} /> }}
      />
    </Tabs>
  );
}
