import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { MedicineIconContainer } from "@/components/ui/MedicineIcon";
import { useApp } from "@/context/AppContext";
import {
  fetchMedicinesCatalog,
  type SearchableMedicine,
} from "@/services/backendCatalog";

const ALL_FORMS = "All Forms";

export default function SearchScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { t } = useApp();

  const [query, setQuery] = useState("");
  const [activeForm, setActiveForm] = useState(ALL_FORMS);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: medicines = [], isLoading, isFetching, error } = useQuery<
    SearchableMedicine[]
  >({
    queryKey: ["catalog", "medicines", debouncedQuery],
    queryFn: () => fetchMedicinesCatalog(debouncedQuery),
  });

  useEffect(() => {
    if (
      activeForm !== ALL_FORMS &&
      !medicines.some((item) => item.dosageForm === activeForm)
    ) {
      setActiveForm(ALL_FORMS);
    }
  }, [activeForm, medicines]);

  const dosageForms = useMemo(() => {
    const forms = [...new Set(medicines.map((item) => item.dosageForm))];
    return [ALL_FORMS, ...forms];
  }, [medicines]);

  const results = useMemo(() => {
    if (activeForm === ALL_FORMS) return medicines;
    return medicines.filter((item) => item.dosageForm === activeForm);
  }, [activeForm, medicines]);

  const resultsLabel =
    results.length === 1
      ? t("medicineFound", { count: results.length })
      : t("medicinesFound", { count: results.length });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding,
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>{t("findMedication")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}> 
          {t("searchAndLocateNearbyPharmacies")}
        </Text>

        <Pressable
          onPress={() => inputRef.current?.focus()}
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchMedicationsPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== "ios" && (
            <Pressable onPress={() => setQuery("")}> 
              <Feather name="x-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </Pressable>
      </View>

      <View style={[styles.categoriesWrapper, { borderBottomColor: colors.borderLight }]}> 
        <FlatList
          horizontal
          data={dosageForms}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveForm(item)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    activeForm === item ? colors.primary : colors.surfaceSecondary,
                  borderColor: activeForm === item ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: activeForm === item ? "#fff" : colors.textSecondary },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.headerStateContainer}>
            {isLoading || isFetching ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
                  {t("loadingMedicines")}
                </Text>
              </View>
            ) : error ? (
              <Text style={[styles.resultsCount, { color: colors.error }]}> 
                {error instanceof Error ? error.message : t("failedToLoadMedicines")}
              </Text>
            ) : results.length > 0 ? (
              <Text style={[styles.resultsCount, { color: colors.textMuted }]}> 
                {resultsLabel}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyState, { borderColor: colors.border }]}> 
            <Feather name="search" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}> 
              {t("noResultsFound")}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}> 
              {t("trySearchingByMedicationNameOrChangingDosageForm")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/pharmacies/[medicineId]",
                params: { medicineId: item.id, medicineName: item.name },
              })
            }
            style={({ pressed }) => [
              styles.resultCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
          >
            <MedicineIconContainer form={item.dosageForm} size={46} />
            <View style={styles.resultInfo}>
              <Text style={[styles.resultName, { color: colors.text }]}> 
                {item.name}
              </Text>
              <Text style={[styles.resultGeneric, { color: colors.textSecondary }]}> 
                {item.genericName}
              </Text>
              <View style={styles.resultMeta}>
                <View style={[styles.categoryTag, { backgroundColor: colors.primary + "15" }]}> 
                  <Text style={[styles.categoryTagText, { color: colors.primary }]}> 
                    {item.category}
                  </Text>
                </View>
                <Text style={[styles.strengthText, { color: colors.textMuted }]}> 
                  {item.strength} · {item.dosageForm}
                </Text>
              </View>
            </View>
            <View style={styles.resultAction}>
              <View style={[styles.pharmaciesBtn, { backgroundColor: colors.primary + "12" }]}> 
                <Feather name="map-pin" size={12} color={colors.primary} />
                <Text style={[styles.pharmaciesBtnText, { color: colors.primary }]}> 
                  {t("find")}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 6,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  categoriesWrapper: {
    borderBottomWidth: 1,
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 4,
  },
  resultsCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  headerStateContainer: {
    minHeight: 24,
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  resultInfo: { flex: 1, gap: 3 },
  resultName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  resultGeneric: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  resultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryTagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  strengthText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "capitalize",
  },
  resultAction: {
    alignItems: "center",
    gap: 4,
  },
  pharmaciesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pharmaciesBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
