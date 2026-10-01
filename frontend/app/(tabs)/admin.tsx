import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  ScrollView, Platform, KeyboardAvoidingView, RefreshControl, Linking,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/theme";
import {
  adminLogin, adminListStudents, adminDeleteStudent, Student, StudentType,
  adminListAdmissions, adminAddAdmissions, adminDeleteAdmission, AdmissionEntry,
  adminExportUrl, adminFetchExportCsv,
} from "@/src/api";
import StudentDetailSheet from "@/src/components/StudentDetailSheet";

type Section = "students" | "admissions";
type TypeFilter = "all" | StudentType;

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [section, setSection] = useState<Section>("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionEntry[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [admissionInput, setAdmissionInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);

  const onExport = async () => {
    const type = typeFilter === "all" ? null : typeFilter;
    setExporting(true);
    try {
      if (Platform.OS === "web") {
        await Linking.openURL(adminExportUrl(type));
      } else {
        const csvText = await adminFetchExportCsv(type);
        const file = new File(Paths.cache, `taal-tarang-students${type ? `-${type.toLowerCase()}` : ""}.csv`);
        file.write(csvText);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Export students CSV", UTI: "public.comma-separated-values-text" });
        } else {
          flashToast(`Saved to ${file.uri}`);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      flashToast(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const doLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      await adminLogin(username.trim(), password.trim());
      setAuthed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadAll();
    } catch (e: any) {
      setLoginError(e?.message ?? "Login failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoginLoading(false);
    }
  };

  const loadAll = async () => {
    setListLoading(true);
    try {
      const [list, adm] = await Promise.all([adminListStudents(), adminListAdmissions()]);
      setStudents(list);
      setAdmissions(adm);
    } catch (e: any) {
      flashToast(e?.message ?? "Failed to load data");
    } finally {
      setListLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (authed) loadAll();
    }, [authed]),
  );

  const onDelete = async (s: Student) => {
    setActionId(s.id);
    try {
      await adminDeleteStudent(s.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      flashToast(`Deleted ${s.full_name}`);
      await loadAll();
    } catch (e: any) {
      flashToast(e?.message ?? "Delete failed");
    } finally {
      setActionId(null);
    }
  };

  const onAddAdmissions = async () => {
    const values = admissionInput.split(/[\n,;\s]+/).map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) {
      flashToast("Enter at least one admission number");
      return;
    }
    setAdding(true);
    try {
      const res = await adminAddAdmissions(values);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flashToast(`Added ${res.added}${res.skipped ? ` · ${res.skipped} already existed` : ""}`);
      setAdmissionInput("");
      await loadAll();
    } catch (e: any) {
      flashToast(e?.message ?? "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const onDeleteAdmission = async (a: AdmissionEntry) => {
    setActionId(a.admission_no);
    try {
      await adminDeleteAdmission(a.admission_no);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      flashToast(`Removed ${a.admission_no}`);
      await loadAll();
    } catch (e: any) {
      flashToast(e?.message ?? "Remove failed");
    } finally {
      setActionId(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const registeredSet = new Set(students.map((s) => s.admission_no));
  const stats = {
    students: students.length,
    admissions: admissions.length,
    unregistered: admissions.filter((a) => !registeredSet.has(a.admission_no)).length,
  };

  const q = search.trim().toLowerCase();
  const typeStudents = typeFilter === "all" ? students : students.filter((s) => s.type === typeFilter);
  const typeCounts = {
    all: students.length,
    "Free-Style": students.filter((s) => s.type === "Free-Style").length,
    Workshop: students.filter((s) => s.type === "Workshop").length,
  };
  const filteredStudents = q
    ? typeStudents.filter((s) =>
        [s.full_name, s.admission_no, s.phone_no, s.whatsapp_no, s.student_class, s.father_name, s.email]
          .some((v) => v?.toLowerCase().includes(q)),
      )
    : typeStudents;
  const filteredAdmissions = q
    ? admissions.filter((a) => a.admission_no.toLowerCase().includes(q))
    : admissions;

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
                  autoCorrect={false}
                  autoComplete="off"
                  style={styles.input}
                  testID="admin-username"
                />
              </View>
              <View>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    textContentType="none"
                    style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]}
                    testID="admin-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                    testID="toggle-password-btn"
                  >
                    <MaterialIcon name={showPassword ? "eye-off" : "eye"} size={20} color={colors.muted} />
                  </Pressable>
                </View>
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
            <Text style={styles.headerSub}>Manage admission list & registrations</Text>
          </View>
          <Pressable
            onPress={() => { setAuthed(false); setUsername(""); setPassword(""); setStudents([]); setAdmissions([]); }}
            style={styles.logoutBtn}
            testID="admin-logout-btn"
          >
            <MaterialIcon name="logout" size={16} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.statsRow}>
          <StatBox label="Registered" value={stats.students} color={colors.success} testID="stat-students" />
          <StatBox label="Admission Nos" value={stats.admissions} color={colors.brandTertiary} testID="stat-admissions" />
          <StatBox label="Not Yet Reg." value={stats.unregistered} color={colors.warning} testID="stat-unregistered" />
        </View>
        <View style={styles.filterRow}>
          {(["students", "admissions"] as Section[]).map((k) => {
            const active = section === k;
            return (
              <Pressable
                key={k}
                onPress={() => { Haptics.selectionAsync(); setSection(k); }}
                style={[styles.filterChip, active && styles.filterChipActive]}
                testID={`section-${k}`}
              >
                <MaterialIcon
                  name={k === "students" ? "account-group" : "format-list-numbered"}
                  size={14}
                  color={active ? colors.onBrandPrimary : colors.muted}
                />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {k === "students" ? "Registered Students" : "Admission No List"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.searchRow}>
          <MaterialIcon name="magnify" size={20} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={section === "students" ? "Search name, admission no, phone, class…" : "Search admission no…"}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
            testID="admin-search-input"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} style={styles.clearBtn} hitSlop={8} testID="admin-search-clear">
              <MaterialIcon name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
        {q.length > 0 && (
          <Text style={styles.resultCount} testID="admin-search-count">
            {section === "students"
              ? `${filteredStudents.length} of ${typeStudents.length} students`
              : `${filteredAdmissions.length} of ${admissions.length} admission numbers`}
          </Text>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandTertiary} />
        }
      >
        {listLoading && !refreshing && (
          <ActivityIndicator color={colors.brandTertiary} style={{ marginTop: spacing.xl }} />
        )}

        {section === "admissions" && (
          <>
            <View style={styles.addCard} testID="add-admission-card">
              <Text style={styles.addTitle}>Add Admission Numbers</Text>
              <Text style={styles.addSub}>
                Paste one or many numbers — separated by comma, space or new line. Only these students can register.
              </Text>
              <TextInput
                value={admissionInput}
                onChangeText={setAdmissionInput}
                placeholder={"e.g. 2026001, 2026002\n2026003"}
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                multiline
                style={[styles.input, { height: 96, textAlignVertical: "top" }]}
                testID="admission-input"
              />
              <Pressable onPress={onAddAdmissions} disabled={adding} style={styles.cta} testID="add-admission-btn">
                {adding ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>Add to List</Text>
                )}
              </Pressable>
            </View>

            {!listLoading && filteredAdmissions.length === 0 && (
              <View style={styles.emptyBox} testID="admissions-empty">
                <MaterialIcon name={q ? "magnify-close" : "format-list-bulleted"} size={32} color={colors.muted} />
                <Text style={styles.emptyText}>
                  {q ? `No admission numbers match "${search.trim()}"` : "No admission numbers added yet"}
                </Text>
              </View>
            )}
            {filteredAdmissions.map((a) => {
              const registered = registeredSet.has(a.admission_no);
              return (
                <View key={a.admission_no} style={styles.admRow} testID={`admission-row-${a.admission_no}`}>
                  <MaterialIcon
                    name={registered ? "account-check" : "account-clock-outline"}
                    size={20}
                    color={registered ? colors.success : colors.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.admNo}>{a.admission_no}</Text>
                    <Text style={styles.rowMeta}>{registered ? "Registered" : "Not registered yet"}</Text>
                  </View>
                  <Pressable
                    disabled={actionId === a.admission_no}
                    onPress={() => onDeleteAdmission(a)}
                    style={styles.iconBtn}
                    testID={`delete-admission-${a.admission_no}`}
                  >
                    {actionId === a.admission_no ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <MaterialIcon name="trash-can-outline" size={18} color={colors.error} />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {section === "students" && (
          <View style={styles.toolsRow} testID="type-filter-row">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} style={{ flex: 1 }}>
              {(["all", "Free-Style", "Workshop"] as TypeFilter[]).map((t) => {
                const active = typeFilter === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => { Haptics.selectionAsync(); setTypeFilter(t); }}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    testID={`type-filter-${t === "all" ? "all" : t.toLowerCase()}`}
                  >
                    {t !== "all" && (
                      <MaterialIcon
                        name={t === "Workshop" ? "school" : "music"}
                        size={13}
                        color={active ? colors.onBrandTertiary : colors.muted}
                      />
                    )}
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                      {t === "all" ? "All" : t} · {typeCounts[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={onExport}
              disabled={exporting || typeStudents.length === 0}
              style={[styles.exportBtn, (exporting || typeStudents.length === 0) && { opacity: 0.5 }]}
              testID="export-csv-btn"
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.onSurface} />
              ) : (
                <>
                  <MaterialIcon name="file-download-outline" size={16} color={colors.onSurface} />
                  <Text style={styles.exportText}>CSV</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {section === "students" && !listLoading && filteredStudents.length === 0 && (
          <View style={styles.emptyBox} testID="admin-empty">
            <MaterialIcon name={q ? "magnify-close" : "account-off"} size={32} color={colors.muted} />
            <Text style={styles.emptyText}>
              {q
                ? `No students match "${search.trim()}"`
                : typeFilter === "all"
                  ? "No students registered yet"
                  : `No ${typeFilter} students yet`}
            </Text>
          </View>
        )}
        {section === "students" && filteredStudents.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => { Haptics.selectionAsync(); setSelected(s); }}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            testID={`student-row-${s.id}`}
          >
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
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.rowName}>{s.full_name}</Text>
                <MaterialIcon name="chevron-right" size={20} color={colors.muted} />
              </View>
              <Text style={styles.rowMeta}>Adm: {s.admission_no} · {s.student_class}</Text>
              <Text style={styles.rowMeta}>+91 {s.phone_no} · {s.type}</Text>
              <Text style={styles.rowMeta}>Registered {s.date_of_registration}</Text>
              <View style={styles.rowActions}>
                <Pressable
                  disabled={actionId === s.id}
                  onPress={(e) => { e.stopPropagation?.(); onDelete(s); }}
                  style={[styles.actionBtn, { backgroundColor: colors.error }]}
                  testID={`delete-${s.id}`}
                >
                  {actionId === s.id ? (
                    <ActivityIndicator size="small" color={colors.onError} />
                  ) : (
                    <>
                      <MaterialIcon name="trash-can-outline" size={14} color={colors.onError} />
                      <Text style={[styles.actionText, { color: colors.onError }]}>Delete</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      </KeyboardAvoidingView>

      <StudentDetailSheet
        student={selected}
        onClose={() => setSelected(null)}
        onDelete={(s) => { setSelected(null); onDelete(s); }}
      />

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
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filterChipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: colors.onBrandPrimary },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 14, paddingVertical: Platform.OS === "ios" ? 12 : 8 },
  clearBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  resultCount: { color: colors.muted, fontSize: 12, marginTop: spacing.sm, fontWeight: "600" },
  toolsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brandTertiary },
  typeChipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  typeChipTextActive: { color: colors.onBrandTertiary },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  exportText: { color: colors.onSurface, fontSize: 12, fontWeight: "800" },

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
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingRight: spacing.xs,
  },
  eyeBtn: {
    width: 44, height: 44,
    alignItems: "center", justifyContent: "center",
  },
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

  addCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  addTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  addSub: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  admRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  admNo: { color: colors.onSurface, fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },

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
