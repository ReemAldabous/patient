import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import React, { useMemo, useState } from "react";
import { useEffect } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Pressable,
} from "react-native";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { LeafletMap } from "@/components/LeafletMap";
import { PharmacyCard } from "@/components/PharmacyCard";
import {
  DEFAULT_NEARBY_PARAMS,
  fetchPharmaciesForMedicine,
} from "@/services/backendCatalog";
import type { Pharmacy } from "@/models";

export default function PharmaciesScreen() {
  const { medicineId, medicineName } = useLocalSearchParams<{
    medicineId: string;
    medicineName: string;
  }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const { t } = useApp();
  const [filterInStock, setFilterInStock] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationState, setLocationState] = useState<
    "loading" | "ready" | "denied" | "unavailable"
  >("loading");
  const medicineIdParam = Array.isArray(medicineId)
    ? medicineId[0]
    : medicineId;

  useEffect(() => {
    let isActive = true;

    async function loadLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isActive) return;

        if (permission.status !== "granted") {
          setLocationState("denied");
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isActive) return;

        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationState("ready");
      } catch {
        if (!isActive) return;
        setLocationState("unavailable");
      }
    }

    void loadLocation();

    return () => {
      isActive = false;
    };
  }, []);

  const effectiveLocation = userLocation ?? {
    latitude: DEFAULT_NEARBY_PARAMS.lat,
    longitude: DEFAULT_NEARBY_PARAMS.lng,
  };

  const {
    data: allPharmacies = [],
    isLoading,
    isFetching,
    error,
  } = useQuery<Pharmacy[]>({
    queryKey: [
      "catalog",
      "pharmacies",
      medicineIdParam,
      effectiveLocation.latitude,
      effectiveLocation.longitude,
    ],
    queryFn: () =>
      fetchPharmaciesForMedicine(medicineIdParam ?? "", {
        lat: effectiveLocation.latitude,
        lng: effectiveLocation.longitude,
      }),
    enabled: Boolean(medicineIdParam) && locationState !== "loading",
  });

  const pharmacies = filterInStock
    ? allPharmacies.filter((p) => p.inStock)
    : allPharmacies;

  const inStockCount = allPharmacies.filter((p) => p.inStock).length;
  const pharmaciesWithCoordinates = pharmacies.filter(
    (item) => item.lat != null && item.lng != null,
  );
  const selectedPharmacy = allPharmacies.find(
    (pharmacy) => pharmacy.id === selectedId,
  );
  const selectedMapPharmacy = pharmaciesWithCoordinates.find(
    (pharmacy) => pharmacy.id === selectedId,
  );
  const centerLat =
    selectedMapPharmacy?.lat ??
    selectedPharmacy?.lat ??
    userLocation?.latitude ??
    pharmaciesWithCoordinates[0]?.lat ??
    40.7389;
  const centerLng =
    selectedMapPharmacy?.lng ??
    selectedPharmacy?.lng ??
    userLocation?.longitude ??
    pharmaciesWithCoordinates[0]?.lng ??
    -73.9903;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Summary header */}
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryMedicine}>
              {medicineName ?? t("medication")}
            </Text>
            <Text style={styles.summarySubtitle}>
              {locationState === "ready"
                ? t("availableNearYourLocation")
                : t("availableAtNearbyPharmacies")}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryCount}>{inStockCount}</Text>
            <Text style={styles.summaryCountLabel}>{t("inStockLabel")}</Text>
          </View>
        </View>

        {locationState !== "ready" && (
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="map-pin" size={14} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {locationState === "loading"
                ? t("readingLocation")
                : t("locationAccessOff")}
            </Text>
          </View>
        )}

        {/* Filter row */}
        <View style={styles.filterRow}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
            {t("pharmaciesFound", { count: pharmacies.length })}
          </Text>
          <Pressable
            onPress={() => setFilterInStock((v) => !v)}
            style={[
              styles.filterBtn,
              {
                backgroundColor: filterInStock
                  ? colors.success + "20"
                  : colors.surfaceSecondary,
                borderColor: filterInStock ? colors.success : colors.border,
              },
            ]}
          >
            <Feather
              name="filter"
              size={13}
              color={filterInStock ? colors.success : colors.textMuted}
            />
            <Text
              style={[
                styles.filterBtnText,
                {
                  color: filterInStock ? colors.success : colors.textSecondary,
                },
              ]}
            >
              {filterInStock ? t("inStockOnly") : t("allPharmacies")}
            </Text>
          </Pressable>
        </View>

        {(isLoading || isFetching) && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              {t("loadingPharmacies")}
            </Text>
          </View>
        )}

        {!!error && (
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: colors.error + "10",
                borderColor: colors.error + "35",
              },
            ]}
          >
            <Feather name="alert-triangle" size={14} color={colors.error} />
            <Text style={[styles.infoText, { color: colors.error }]}>
              {error instanceof Error
                ? error.message
                : t("failedToLoadPharmacies")}
            </Text>
          </View>
        )}

        {pharmaciesWithCoordinates.length > 0 && (
          <>
            {/* Leaflet map */}
            <View style={[styles.mapContainer, { borderColor: colors.border }]}>
              <LeafletMap
                key={`${selectedId ?? "none"}-${centerLat}-${centerLng}-${pharmaciesWithCoordinates.length}`}
                pharmacies={pharmaciesWithCoordinates}
                centerLat={centerLat}
                centerLng={centerLng}
                userLat={userLocation?.latitude}
                userLng={userLocation?.longitude}
                selectedPharmacyId={selectedId ?? undefined}
                height={280}
              />
              <View
                style={[
                  styles.mapLegend,
                  { backgroundColor: colors.surface + "EE" },
                ]}
              >
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: colors.success },
                    ]}
                  />
                  <Text
                    style={[styles.legendText, { color: colors.textSecondary }]}
                  >
                    {t("inStockLabel")}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: colors.error },
                    ]}
                  />
                  <Text
                    style={[styles.legendText, { color: colors.textSecondary }]}
                  >
                    {t("outOfStockLabel")}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.infoBanner,
                {
                  backgroundColor: colors.primary + "10",
                  borderColor: colors.primary + "25",
                },
              ]}
            >
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>
                {t("mapCardHint")}
              </Text>
            </View>
          </>
        )}

        {pharmaciesWithCoordinates.length === 0 &&
          !isLoading &&
          !isFetching &&
          !error && (
            <View
              style={[
                styles.infoBanner,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="map" size={14} color={colors.textMuted} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                {t("mapCoordinatesUnavailable")}
              </Text>
            </View>
          )}

        {/* Pharmacy list */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t("nearbyPharmacies")}
        </Text>

        {pharmacies.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Feather name="map-pin" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No results
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              No pharmacies have this medication in stock right now. Try
              removing the filter.
            </Text>
          </View>
        ) : (
          pharmacies.map((pharmacy) => (
            <PharmacyCard
              key={pharmacy.id}
              pharmacy={pharmacy}
              isSelected={selectedId === pharmacy.id}
              onPress={() =>
                setSelectedId((id) => (id === pharmacy.id ? null : pharmacy.id))
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  summaryCard: {
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryLeft: {
    flex: 1,
    gap: 4,
  },
  summaryMedicine: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  summarySubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  summaryRight: {
    alignItems: "center",
  },
  summaryCount: {
    color: "#fff",
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    lineHeight: 40,
  },
  summaryCountLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  filterBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  mapContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  mapLegend: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  loadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
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
