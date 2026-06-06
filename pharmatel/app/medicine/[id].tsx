import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { formatDate, foodRequirementLabel } from "@/utils/time";
import { MedicineIconContainer } from "@/components/ui/MedicineIcon";
import { FirstDoseTimeEditor } from "@/components/ui/FirstDoseTimeEditor";
import {
  hasConfiguredTimeShift,
  shiftToTimeString,
  timeStringToShift,
} from "@/services/doseScheduler";

export default function MedicineDetailScreen() {
  const { id, prescriptionId } = useLocalSearchParams<{
    id: string;
    prescriptionId: string;
  }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];
  const {
    prescriptions,
    locale,
    language,
    t,
    markPrescriptionDone,
    updatePrescriptionTimeShift,
  } = useApp();
  const [firstDoseTime, setFirstDoseTime] = useState("08:00");
  const [savingTime, setSavingTime] = useState(false);

  const prescription = useMemo(
    () => prescriptions.find((rx) => rx.id === prescriptionId),
    [prescriptions, prescriptionId]
  );
  const medicine = prescription?.medicine;

  useEffect(() => {
    if (!prescription) return;
    setFirstDoseTime(
      hasConfiguredTimeShift(prescription)
        ? shiftToTimeString(prescription.timeShift!)
        : "08:00",
    );
  }, [prescription?.id, prescription?.timeShift]);

  if (!medicine || !prescription) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          {t("medicationNotFound")}
        </Text>
      </View>
    );
  }

  const takenCount = prescription.doseSchedules.filter((d) => d.status === "taken").length;
  const totalCount = prescription.doseSchedules.length;
  const adherence = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <MedicineIconContainer
            form={medicine.dosageForm}
            bgColor="rgba(255,255,255,0.2)"
            size={72}
          />
          <Text style={styles.heroName}>{medicine.name}</Text>
          <Text style={styles.heroGeneric}>{medicine.genericName}</Text>
          <View style={styles.heroChips}>
            <HeroChip label={medicine.strength} />
            <HeroChip label={medicine.dosageForm} />
            {medicine.manufacturer && <HeroChip label={medicine.manufacturer} />}
          </View>
        </View>

        {/* Prescription details */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t("prescriptionDetails")}</Text>
          <DetailRow label={t("doseLabel")} value={prescription.dose} colors={colors} icon="activity" />
          <DetailRow label={t("frequencyLabel")} value={prescription.frequency} colors={colors} icon="repeat" />
          <DetailRow
            label={t("foodRequirement")}
            value={foodRequirementLabel(prescription.foodRequirement, language)}
            colors={colors}
            icon="coffee"
          />
          <DetailRow
            label={t("startDateLabel")}
            value={formatDate(prescription.startDate, locale)}
            colors={colors}
            icon="calendar"
          />
          {prescription.endDate && (
            <DetailRow
              label={t("endDateLabel")}
              value={formatDate(prescription.endDate, locale)}
              colors={colors}
              icon="calendar"
            />
          )}
          <DetailRow
            label={t("prescribedByLabel")}
            value={prescription.prescribedBy}
            colors={colors}
            icon="user"
          />
          {(prescription.note ?? prescription.notes) && (
            <DetailRow
              label={t("yourNote")}
              value={prescription.note ?? prescription.notes ?? ""}
              colors={colors}
              icon="file-text"
            />
          )}
        </View>

        {!prescription.isDone && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {t("firstDoseTime")}
            </Text>
            {!hasConfiguredTimeShift(prescription) && (
              <Text
                style={[styles.timeHint, { color: colors.textSecondary }]}
              >
                {t("timeShiftNotSet")}
              </Text>
            )}
            <FirstDoseTimeEditor
              value={firstDoseTime}
              onChange={setFirstDoseTime}
              colors={colors}
              label={t("firstDoseTime")}
            />
            <Pressable
              disabled={savingTime || firstDoseTime.length < 5}
              onPress={() => {
                void (async () => {
                  setSavingTime(true);
                  try {
                    await updatePrescriptionTimeShift(
                      prescription.id,
                      timeStringToShift(firstDoseTime),
                    );
                  } catch {
                    Alert.alert(t("deleteFailed"), t("saveTimeShift"));
                  } finally {
                    setSavingTime(false);
                  }
                })();
              }}
              style={({ pressed }) => [
                styles.saveTimeBtn,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    pressed || savingTime || firstDoseTime.length < 5
                      ? 0.7
                      : 1,
                },
              ]}
            >
              <Text style={styles.saveTimeBtnText}>
                {savingTime ? t("saving") : t("saveTimeShift")}
              </Text>
            </Pressable>
          </View>
        )}

        {!prescription.isDone && (
          <Pressable
            onPress={() => {
              Alert.alert(t("markPrescriptionDone"), "", [
                { text: t("cancel"), style: "cancel" },
                {
                  text: t("remove"),
                  onPress: () => {
                    void markPrescriptionDone(prescription.id);
                  },
                },
              ]);
            }}
            style={({ pressed }) => [
              styles.doneBtn,
              {
                backgroundColor: colors.success + "18",
                borderColor: colors.success + "40",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="check-circle" size={18} color={colors.success} />
            <Text style={[styles.doneBtnText, { color: colors.success }]}>
              {t("markPrescriptionDone")}
            </Text>
          </Pressable>
        )}

        {/* Adherence */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t("adherence")}</Text>
          <View style={styles.adherenceRow}>
            <View style={styles.adherenceLeft}>
              <Text style={[styles.adherencePercent, { color: colors.text }]}>
                {adherence}%
              </Text>
              <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>
                {t("dosesTakenCount", { taken: takenCount, total: totalCount })}
              </Text>
            </View>
            <View style={styles.adherenceRight}>
              <View style={[styles.adherenceBar, { backgroundColor: colors.borderLight }]}>
                <View
                  style={[
                    styles.adherenceFill,
                    {
                      width: `${adherence}%`,
                      backgroundColor: adherence >= 80 ? colors.success : adherence >= 50 ? colors.warning : colors.error,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.adherenceStatus, { color: adherence >= 80 ? colors.success : colors.warning }]}> 
                {adherence >= 80 ? t("good") : adherence >= 50 ? t("fair") : t("needsImprovement")}
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {medicine.description && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{t("aboutThisMedication")}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {medicine.description}
            </Text>
          </View>
        )}

        {/* Side effects */}
        {medicine.sideEffects && medicine.sideEffects.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sideEffectsHeader}>
              <Feather name="alert-triangle" size={16} color={colors.warning} />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>
                {t("possibleSideEffects")}
              </Text>
            </View>
            <View style={styles.sideEffectsList}>
              {medicine.sideEffects.map((effect, i) => (
                <View key={i} style={[styles.sideEffectItem, { backgroundColor: colors.surfaceSecondary }]}>
                  <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.sideEffectText, { color: colors.textSecondary }]}>
                    {effect}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function HeroChip({ label }: { label: string }) {
  return (
    <View style={styles.heroChip}>
      <Text style={styles.heroChipText}>{label}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  colors,
  icon,
}: {
  label: string;
  value: string;
  colors: any;
  icon: string;
}) {
  return (
    <View style={[styles.detailRow, { borderTopColor: colors.borderLight }]}>
      <Feather name={icon as any} size={14} color={colors.textMuted} />
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  heroName: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  heroGeneric: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  heroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  heroChip: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroChipText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  timeHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
    lineHeight: 18,
  },
  saveTimeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  saveTimeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    width: 110,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
    textAlign: "right",
  },
  adherenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  adherenceLeft: {
    gap: 4,
  },
  adherencePercent: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  adherenceLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  adherenceRight: {
    flex: 1,
    gap: 8,
  },
  adherenceBar: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  adherenceFill: {
    height: "100%",
    borderRadius: 5,
  },
  adherenceStatus: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  sideEffectsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sideEffectsList: {
    gap: 8,
  },
  sideEffectItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sideEffectText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
