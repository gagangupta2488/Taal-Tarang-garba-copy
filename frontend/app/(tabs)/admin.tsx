import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  ScrollView, Platform, KeyboardAvoidingView, RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/theme";
import {
  adminLogin, adminListStudents, adminApproveStudent, adminDeleteStudent, Student,
} from "@/src/api";

type FilterKey = "all" | "pending" | "approved";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const doLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      await adminLogin(username.trim(), password);
      setAuthed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadStudents();
    } catch (e: any) {
      setLoginError(e?.message ?? "Login failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoginLoading(false);
    }
  };

  const loadStudents = async () => {
    setListLoading(true);
    try {
      const list = await adminListStudents();
      setStudents(list);
    } catch (e: any) {
      flashToast(e?.message ?? "Failed to load students");
    } finally {
      setListLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (authed) loadStudents();
    }, [authed]),
  );

  const onApprove = async (s: Student) => {
    setActionId(s.id);
    try {
      await adminApproveStudent(s.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flashToast(`Approved ${s.full_name}`);
      await loadStudents();
    } catch (e: any) {
      flashToast(e?.message ?? "Approval failed");
    } finally {
      setActionId(null);
    }
  };

  const onDelete = async (s: Student) => {
    setActionId(s.id);
    try {
      await adminDeleteStudent(s.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      flashToast(`Deleted ${s.full_name}`);
      await loadStudents();
    } catch (e: any) {
      flashToast(e?.message ?? "Delete failed");
    } finally {
      setActionId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  };

  const filtered = students.filter((s) => {
    if (filter === "pending") return !s.approved;
    if (filter === "approved") return s.approved;
    return true;
  });

  const stats = {
    total: students.length,
    approved: students.filter((s) => s.approved).length,
    pending: students.filter((s) => !s.approved).length,
  };

  if (!authed) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text style={styles.headerTitle}>Admin Access</Text>
          <Text style={styles.headerSub}>Manage student registrations</Text>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.loginCard} testID="admin-login-card">
              <View style={styles.iconHero}>
                <MaterialIcon name="shield-lock" size={34} color={colors.brandTertiary} />
              </View>
              <Text style={styles.cardTitle}>Admin Sign In</Text>
              <Text style={styles.cardSub}>Only authorized staff can access this panel.</Text>
              <View>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="admin"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  style={styles.input}
                  testID="admin-username"
                />
              </View>
              <View>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                  style={styles.input}
                  testID="admin-password"
                />
              </View>
              {loginError && <Text style={styles.errorText} testID="admin-login-error">{loginError}</Text>}
              <Pressable onPress={doLogin} disabled={loginLoading} style={styles.cta} testID="admin-login-btn">
                {loginLoading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>Sign In</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSub}>Approve & manage registrations</Text>
          </View>
          <Pressable
            onPress={() => { setAuthed(false); setUsername(""); setPassword(""); setStudents([]); }}
            style={styles.logoutBtn}
            testID="admin-logout-btn"
          >
            <MaterialIcon name="logout" size={16} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.statsRow}>
          <StatBox label="Total" value={stats.total} color={colors.brandTertiary} testID="stat-total" />
          <StatBox label="Pending" value={stats.pending} color={colors.warning} testID="stat-pending" />
          <StatBox label="Approved" value={stats.approved} color={colors.success} testID="stat-approved" />
        </View>
        <View style={styles.filterRow}>
          {(["all", "pending", "approved"] as FilterKey[]).map((k) => {
            const active = filter === k;
            return (
              <Pressable
                key={k}
                onPress={() => { Haptics.selectionAsync(); setFilter(k); }}
                style={[styles.filterChip, active && styles.filterChipActive]}
                testID={`filter-${k}`}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {k[0].toUpperCase() + k.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandTertiary} />
        }
      >
        {listLoading && !refreshing && (
          <ActivityIndicator color={colors.brandTertiary} style={{ marginTop: spacing.xl }} />
        )}
        {!listLoading && filtered.length === 0 && (
          <View style={styles.emptyBox} testID="admin-empty">
            <MaterialIcon name="account-off" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>No students in this view</Text>
          </View>
        )}
        {filtered.map((s) => (
          <View key={s.id} style={styles.row} testID={`student-row-${s.id}`}>
            <View style={styles.rowAvatar}>
              {s.photo_base64 ? (
                <Image source={{ uri: s.photo_base64 }} style={styles.rowAvatarImg} contentFit="cover" />
              ) : (
                <Text style={styles.rowAvatarInit}>
                  {s.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.rowName}>{s.full_name}</Text>
                <View
                  style={[
                    styles.miniBadge,
                    { backgroundColor: s.approved ? colors.success : colors.warning },
                  ]}
                >
                  <Text style={{ color: s.approved ? colors.onSuccess : colors.onWarning, fontSize: 10, fontWeight: "700" }}>
                    {s.approved ? "APPROVED" : "PENDING"}
                  </Text>
                </View>
              </View>
              <Text style={styles.rowMeta}>Adm: {s.admission_no} · {s.student_class}</Text>
              <Text style={styles.rowMeta}>+91 {s.phone_no} · {s.type}</Text>
              <View style={styles.rowActions}>
                {!s.approved && (
                  <Pressable
                    disabled={actionId === s.id}
                    onPress={() => onApprove(s)}
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    testID={`approve-${s.id}`}
                  >
                    {actionId === s.id ? (
                      <ActivityIndicator size="small" color={colors.onSuccess} />
                    ) : (
                      <>
                        <MaterialIcon name="check-bold" size={14} color={colors.onSuccess} />
                        <Text style={[styles.actionText, { color: colors.onSuccess }]}>Approve</Text>
                      </>
                    )}
                  </Pressable>
                )}
                <Pressable
                  disabled={actionId === s.id}
                  onPress={() => onDelete(s)}
                  style={[styles.actionBtn, { backgroundColor: colors.error }]}
                  testID={`delete-${s.id}`}
                >
                  <MaterialIcon name="trash-can-outline" size={14} color={colors.onError} />
                  <Text style={[styles.actionText, { color: colors.onError }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 72 }]} testID="admin-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function StatBox({ label, value, color, testID }: { label: string; value: number; color: string; testID?: string }) {
  return (
    <View style={styles.statBox} testID={testID}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  headerSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  filterChip: {
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  filterChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filterChipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: colors.onBrandPrimary },

  loginCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  iconHero: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center",
  },
  cardTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700", textAlign: "center" },
  cardSub: { color: colors.muted, fontSize: 13, textAlign: "center" },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    color: colors.onSurface,
    fontSize: 15,
    minHeight: 48,
  },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600" },
  cta: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "800" },

  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 2, borderColor: colors.brandTertiary,
    overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  rowAvatarImg: { width: "100%", height: "100%" },
  rowAvatarInit: { color: colors.brandTertiary, fontSize: 16, fontWeight: "800" },
  rowName: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
  rowActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  actionText: { fontSize: 12, fontWeight: "700" },

  emptyBox: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { color: colors.muted, fontSize: 14 },

  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surfaceInverse,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  toastText: { color: colors.onSurfaceInverse, fontSize: 13, fontWeight: "700" },
});
