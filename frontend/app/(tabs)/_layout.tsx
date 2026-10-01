import { Tabs } from "expo-router";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandTertiary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <MaterialIcon name="home-variant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="register"
        options={{
          title: "Register",
          tabBarIcon: ({ color, size }) => <MaterialIcon name="account-plus" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="passes"
        options={{
          title: "My Pass",
          tabBarIcon: ({ color, size }) => <MaterialIcon name="ticket-confirmation" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: ({ color, size }) => <MaterialIcon name="shield-account" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
