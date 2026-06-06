import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  Alert,
} from "react-native";
import Colors from "@/constants/colors";
import { useApp } from "@/context/AppContext";
import { updateDoseSchedule } from "@/services/storage";
import * as Notifications from "expo-notifications";

const ACTION_TAKEN = "TAKEN";
const ACTION_IGNORE = "IGNORE";

export function DoseAlertModal() {
  const { currentDoseNotification, dismissDoseNotification, prescriptions, t } = useApp();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === "dark" ? "dark" : "light"];

  const notification = currentDoseNotification;
  const prescription = notification
    ? prescriptions.find((p) => p.id === notification.prescriptionId)
    : null;

  const doseSchedule = prescription?.doseSchedules.find(
    (ds) => ds.id === notification?.doseScheduleId,
  );

  const handleAction = async (
    action: typeof ACTION_TAKEN | typeof ACTION_IGNORE,
  ) => {
    if (!notification) return;

    try {
      if (action === ACTION_TAKEN) {
        await updateDoseSchedule(
          notification.prescriptionId,
          notification.doseScheduleId,
          {
            status: "taken",
            takenAt: new Date().toISOString(),
          },
        );
        Alert.alert(t("success"), t("doseRecordedSuccess"));
      } else if (action === ACTION_IGNORE) {
        await updateDoseSchedule(
          notification.prescriptionId,
          notification.doseScheduleId,
          {
            status: "skipped",
            takenAt: undefined,
            patientNote: t("doseIgnoredSuccess"),
          },
        );
        Alert.alert(t("skip"), t("doseIgnoredSuccess"));
      }

      await Notifications.dismissNotificationAsync(
        notification.notification.request.identifier,
      );
      dismissDoseNotification();
    } catch (error) {
      console.error("Error handling dose action:", error);
      Alert.alert(t("deleteFailed"), t("doseActionError"));
    }
  };

  return (
    <Modal
      visible={!!notification}
      transparent
      animationType="fade"
      onRequestClose={dismissDoseNotification}
    >
      <View style={styles.container}>
        <View
          style={[
            styles.alertBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Feather name="droplet" size={32} color={colors.primary} />
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={dismissDoseNotification}
            >
              <Feather name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            💊 {t("doseAlertTitle")}
          </Text>

          {/* Medicine Info */}
          {prescription && (
            <View style={styles.infoSection}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t("medicineLabel")}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {prescription.medicine.name}
              </Text>

              <Text
                style={[
                  styles.label,
                  { color: colors.textSecondary, marginTop: 12 },
                ]}
              >
                {t("doseLabel")}
              </Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {prescription.dose}
              </Text>

              {doseSchedule?.scheduledTime && (
                <>
                  <Text
                    style={[
                      styles.label,
                      { color: colors.textSecondary, marginTop: 12 },
                    ]}
                  >
                    {t("scheduledTimeLabel")}
                  </Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    {doseSchedule.scheduledTime}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.ignoreButton,
                {
                  borderColor: colors.error,
                  backgroundColor: colors.error + "10",
                },
              ]}
              onPress={() => handleAction(ACTION_IGNORE)}
            >
              <Feather name="x" size={20} color={colors.error} />
              <Text
                style={[
                  styles.buttonText,
                  { color: colors.error, marginLeft: 8 },
                ]}
              >
                {t("skip")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.takenButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => handleAction(ACTION_TAKEN)}
            >
              <Feather name="check" size={20} color="#fff" />
              <Text
                style={[styles.buttonText, { color: "#fff", marginLeft: 8 }]}
              >
                {t("doseRecordedSuccess")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  alertBox: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  infoSection: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionContainer: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  ignoreButton: {
    borderWidth: 1.5,
  },
  takenButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
