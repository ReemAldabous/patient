import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import Constants from "expo-constants";
import { updateDoseSchedule } from "@/services/storage";

const DOSE_NOTIFICATION_TASK = "DOSE_NOTIFICATION_TASK";
const ACTION_TAKEN = "TAKEN";
const ACTION_IGNORE = "IGNORE";
const IS_EXPO_GO = Constants.appOwnership === "expo";

// Store for in-app modal display
export let incomingDoseNotification: {
  notification: Notifications.Notification;
  prescriptionId: string;
  doseScheduleId: string;
} | null = null;

export function setIncomingDoseNotification(
  notification: {
    notification: Notifications.Notification;
    prescriptionId: string;
    doseScheduleId: string;
  } | null,
) {
  incomingDoseNotification = notification;
}

type DoseNotificationData = {
  prescriptionId?: string;
  doseScheduleId?: string;
};

function getDoseData(payload: unknown): DoseNotificationData {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const prescriptionId =
      typeof p.prescriptionId === "string" ? p.prescriptionId : undefined;
    const doseScheduleId =
      typeof p.doseScheduleId === "string" ? p.doseScheduleId : undefined;
    return { prescriptionId, doseScheduleId };
  }
  return {};
}

export async function handleDoseNotificationAction(
  response: Pick<
    Notifications.NotificationResponse,
    "actionIdentifier" | "notification"
  >,
) {
  const actionIdentifier = response.actionIdentifier;
  const notificationId = response.notification.request.identifier;
  const doseData = getDoseData(response.notification.request.content.data);
  if (!doseData.prescriptionId || !doseData.doseScheduleId) return false;

  try {
    if (actionIdentifier === ACTION_TAKEN) {
      try {
        await updateDoseSchedule(
          doseData.prescriptionId,
          doseData.doseScheduleId,
          {
            status: "taken",
            takenAt: new Date().toISOString(),
          },
        );
      } catch (e) {
        console.warn("Failed to mark dose as taken:", e);
        return false;
      }
      try {
        await Notifications.dismissNotificationAsync(notificationId);
      } catch (e) {
        console.warn("Failed to dismiss notification after TAKEN action:", e);
      }
      return true;
    }

    if (actionIdentifier === ACTION_IGNORE) {
      try {
        await updateDoseSchedule(
          doseData.prescriptionId,
          doseData.doseScheduleId,
          {
            status: "skipped",
            takenAt: undefined,
            patientNote: "Ignored from notification",
          },
        );
      } catch (e) {
        console.warn("Failed to mark dose as skipped:", e);
        return false;
      }
      try {
        await Notifications.dismissNotificationAsync(notificationId);
      } catch (e) {
        console.warn("Failed to dismiss notification after IGNORE action:", e);
      }
      return true;
    }
  } catch (e) {
    console.warn("Unhandled error handling notification action:", e);
    return false;
  }

  return false;
}

// Define the task only if it hasn't been defined yet (avoid duplicate definitions
// when this module is imported multiple times during hot reload or from
// different entry points).
const taskDefinedCheck = (TaskManager as unknown as any).isTaskDefined;
if (!taskDefinedCheck || !taskDefinedCheck(DOSE_NOTIFICATION_TASK)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    DOSE_NOTIFICATION_TASK,
    async ({
      data,
      error,
    }: {
      data?: Notifications.NotificationTaskPayload;
      error?: unknown;
    }) => {
      if (error) return;
      if (!data) return;

      // On Android, action button presses can be delivered here as a NotificationResponse-like payload.
      if (typeof data === "object" && "actionIdentifier" in data) {
        const response = data as unknown as Notifications.NotificationResponse;
        await handleDoseNotificationAction(response);
        return;
      }
    },
  );
}

// Register the notification task with expo-notifications, but swallow errors
// and log them so background registration doesn't crash the app in Expo Go
// or when running in environments that don't support background tasks.
(async () => {
  if (IS_EXPO_GO) return;
  try {
    await Notifications.registerTaskAsync(DOSE_NOTIFICATION_TASK);
  } catch (e) {
    console.warn("Notifications.registerTaskAsync failed:", e);
  }
})();
