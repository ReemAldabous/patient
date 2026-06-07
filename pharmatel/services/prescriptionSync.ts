import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Prescription } from "@/models";
import { apiRequest, isApiConfigured } from "./api";

const SYNC_QUEUE_KEY = "prescription_sync_queue";
const AUTH_TOKEN_KEY = "auth_token";

async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export type SyncQueueItem =
  | {
      type: "prescription_create";
      localId: string;
    }
  | {
      type: "prescription_update";
      id: string;
    }
  | {
      type: "prescription_delete";
      id: string;
    }
  | {
      type: "prescription_done";
      id: string;
    }
  | {
      type: "dose_take";
      prescriptionId: string;
      localDoseId: string;
      takenAt: string;
      note?: string;
    };

type ApiPrescriptionDto = {
  id: string;
};

async function readQueue(): Promise<SyncQueueItem[]> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SyncQueueItem[];
  } catch {
    return [];
  }
}

async function writeQueue(items: SyncQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueSync(item: SyncQueueItem): Promise<void> {
  const queue = await readQueue();
  const duplicate = queue.some((existing) => {
    if (item.type === "dose_take" && existing.type === "dose_take") {
      return existing.localDoseId === item.localDoseId;
    }
    if (
      (item.type === "prescription_create" &&
        existing.type === "prescription_create") ||
      (item.type === "prescription_update" &&
        existing.type === "prescription_update") ||
      (item.type === "prescription_delete" &&
        existing.type === "prescription_delete") ||
      (item.type === "prescription_done" && existing.type === "prescription_done")
    ) {
      const itemId =
        "localId" in item ? item.localId : "id" in item ? item.id : "";
      const existingId =
        "localId" in existing
          ? existing.localId
          : "id" in existing
            ? existing.id
            : "";
      return itemId === existingId;
    }
    return false;
  });

  if (!duplicate) {
    queue.push(item);
    await writeQueue(queue);
  }
}

function toBackendFrequency(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "once daily") return "24 hours";
  if (normalized === "twice daily") return "12 hours";
  if (normalized === "three times daily") return "8 hours";
  if (normalized === "four times daily") return "6 hours";
  if (normalized === "weekly") return "168 hours";
  if (normalized === "as needed") return "24 hours";
  const match = normalized.match(/(\d+)/);
  if (match) return `${match[1]} hours`;
  return "24 hours";
}

function toBackendDateTime(value: string, endOfDay = false): string {
  const trimmed = value.trim();
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T${endOfDay ? "23:59:59" : "08:00:00"}`;
}

function buildCreateBody(rx: Prescription, patientId: number) {
  const medicineId = Number.parseInt(rx.medicineId, 10);
  return {
    patientId,
    medicineId,
    dose: rx.dose,
    frequency: toBackendFrequency(rx.frequency),
    startDate: toBackendDateTime(rx.startDate),
    endDate: rx.endDate ? toBackendDateTime(rx.endDate, true) : null,
    byPharmacist: false,
    foodRequirement: rx.foodRequirement,
    note: rx.note ?? rx.notes ?? null,
    byDoctor: rx.byDoctor ?? false,
    doctorName: rx.doctorName ?? null,
    timeShift: rx.timeShift ?? 0

  };
}

function buildUpdateBody(rx: Prescription) {
  return {
    dose: rx.dose,
    frequency: toBackendFrequency(rx.frequency),
    startDate: toBackendDateTime(rx.startDate),
    endDate: rx.endDate ? toBackendDateTime(rx.endDate, true) : null,
    byPharmacist: false,
    foodRequirement: rx.foodRequirement,
    note: rx.note ?? rx.notes ?? null,
    byDoctor: rx.byDoctor ?? false,
    doctorName: rx.doctorName ?? null,
    timeShift: rx.timeShift ?? 0,
    isDone: rx.isDone ?? false,
  };
}

export type SyncResult = {
  idMap: Map<string, string>;
  processed: number;
  failed: number;
};

export async function processSyncQueue(
  prescriptions: Prescription[],
  patientId: number,
  onPrescriptionsUpdated: (next: Prescription[]) => Promise<void>,
): Promise<SyncResult> {
  const idMap = new Map<string, string>();
  let processed = 0;
  let failed = 0;

  if (!isApiConfigured()) {
    return { idMap, processed, failed };
  }

  const token = await getAuthToken();
  if (!token) return { idMap, processed, failed };

  let queue = await readQueue();
  let current = [...prescriptions];

  const resolveId = (id: string) => idMap.get(id) ?? id;

  const findRx = (id: string) =>
    current.find((rx) => rx.id === id || rx.id === resolveId(id));

  const remaining: SyncQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === "prescription_create") {
        const rx = findRx(item.localId);
        if (!rx) {
          processed += 1;
          continue;
        }
        const created = await apiRequest<ApiPrescriptionDto>(
          "/prescriptions",
          {
            method: "POST",
            body: JSON.stringify(buildCreateBody(rx, patientId)),
          },
          token,
        );
        idMap.set(item.localId, created.id);
        current = current.map((entry) =>
          entry.id === item.localId
            ? {
                ...entry,
                id: created.id,
                syncStatus: "synced",
                doseSchedules: entry.doseSchedules.map((dose) => ({
                  ...dose,
                  prescriptionId: created.id,
                })),
              }
            : entry,
        );
        processed += 1;
        continue;
      }

      if (item.type === "prescription_update") {
        const rx = findRx(item.id);
        if (!rx || rx.syncStatus === "pending_create") {
          remaining.push(item);
          continue;
        }
        await apiRequest(
          `/prescriptions/${resolveId(item.id)}`,
          {
            method: "PUT",
            body: JSON.stringify(buildUpdateBody(rx)),
          },
          token,
        );
        current = current.map((entry) =>
          entry.id === rx.id ? { ...entry, syncStatus: "synced" } : entry,
        );
        processed += 1;
        continue;
      }

      if (item.type === "prescription_delete") {
        const serverId = resolveId(item.id);
        if (serverId.startsWith("local_")) {
          processed += 1;
          continue;
        }
        await apiRequest(
          `/prescriptions/${serverId}`,
          { method: "DELETE" },
          token,
        );
        current = current.filter((entry) => entry.id !== item.id);
        processed += 1;
        continue;
      }

      if (item.type === "prescription_done") {
        const serverId = resolveId(item.id);
        if (serverId.startsWith("local_")) {
          remaining.push(item);
          continue;
        }
        await apiRequest(
          `/prescriptions/${serverId}/done`,
          { method: "POST" },
          token,
        );
        current = current.map((entry) =>
          entry.id === item.id || entry.id === serverId
            ? { ...entry, isDone: true, syncStatus: "synced" }
            : entry,
        );
        processed += 1;
        continue;
      }

      if (item.type === "dose_take") {
        const rx = findRx(item.prescriptionId);
        if (!rx || rx.syncStatus === "pending_create") {
          remaining.push(item);
          continue;
        }
        const serverRxId = resolveId(rx.id);
        const dose = rx.doseSchedules.find((d) => d.id === item.localDoseId);
        let serverDoseId = dose?.serverId;

        if (serverDoseId != null) {
          await apiRequest(
            `/dose-schedules/${serverDoseId}/take`,
            {
              method: "POST",
              body: JSON.stringify({
                patientPersonalNote: item.note ?? null,
              }),
            },
            token,
          );
        } else {
          const created = await apiRequest<{ id: number }>(
            "/dose-schedules",
            {
              method: "POST",
              body: JSON.stringify({
                prescriptionId: serverRxId,
                taken: true,
                takenAt: item.takenAt,
                patientPersonalNote: item.note ?? null,
              }),
            },
            token,
          );
          serverDoseId = created.id;
        }

        current = current.map((entry) => {
          if (entry.id !== rx.id) return entry;
          return {
            ...entry,
            doseSchedules: entry.doseSchedules.map((d) =>
              d.id === item.localDoseId
                ? {
                    ...d,
                    serverId: serverDoseId,
                    syncStatus: "synced",
                  }
                : d,
            ),
          };
        });
        processed += 1;
      }
    } catch (error) {
      console.warn("Sync queue item failed:", item, error);
      remaining.push(item);
      failed += 1;
    }
  }

  await writeQueue(remaining);
  await onPrescriptionsUpdated(current);

  return { idMap, processed, failed };
}

export async function trySyncPrescriptions(
  prescriptions: Prescription[],
  patientId: number | null,
  onPrescriptionsUpdated: (next: Prescription[]) => Promise<void>,
): Promise<void> {
  if (patientId == null) return;
  await processSyncQueue(prescriptions, patientId, onPrescriptionsUpdated);
}
