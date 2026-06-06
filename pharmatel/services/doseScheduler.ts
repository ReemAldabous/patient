import type { DoseSchedule, Prescription } from "@/models";

const MAX_DOSES_PER_PRESCRIPTION = 500;
const DEFAULT_HORIZON_DAYS = 90;

/** Minutes from midnight for the first dose (e.g. 480 = 08:00). */
export function timeStringToShift(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return 8 * 60;
  const hour = Math.min(23, Number.parseInt(match[1], 10));
  const minute = Math.min(59, Number.parseInt(match[2], 10));
  return hour * 60 + minute;
}

export function shiftToTimeString(shift: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, shift));
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function frequencyToIntervalHours(frequency: string): number {
  const normalized = frequency.trim().toLowerCase();
  if (normalized === "once daily") return 24;
  if (normalized === "twice daily") return 12;
  if (normalized === "three times daily") return 8;
  if (normalized === "four times daily") return 6;
  if (normalized === "weekly") return 168;
  if (normalized === "as needed") return 24;

  const hoursMatch = normalized.match(/(\d+)\s*h/);
  if (hoursMatch) return Math.max(1, Number.parseInt(hoursMatch[1], 10));

  const digit = normalized.match(/(\d+)/);
  if (digit) return Math.max(1, Number.parseInt(digit[1], 10));

  return 24;
}

function parseDateOnly(value: string): Date {
  const trimmed = value.trim();
  if (trimmed.includes("T")) return new Date(trimmed);
  return new Date(`${trimmed}T00:00:00`);
}

function endDateTime(rx: Prescription): Date {
  if (rx.endDate) {
    const end = parseDateOnly(rx.endDate);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  const horizon = parseDateOnly(rx.startDate);
  horizon.setDate(horizon.getDate() + DEFAULT_HORIZON_DAYS);
  horizon.setHours(23, 59, 59, 999);
  return horizon;
}

function buildFirstDoseAt(rx: Prescription): Date {
  const start = parseDateOnly(rx.startDate);
  const shift = rx.timeShift ?? 8 * 60;
  start.setHours(Math.floor(shift / 60), shift % 60, 0, 0);
  return start;
}

function localDoseId(prescriptionId: string, at: Date): string {
  return `dose_${prescriptionId}_${at.getTime()}`;
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:${s}`;
}

function extractHHMM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "08:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** True after the user sets first-dose time on the prescription (post-create). */
export function hasConfiguredTimeShift(rx: Prescription): boolean {
  return rx.timeShift != null && rx.timeShift > 0;
}

/** Build dose schedules from prescription start, frequency, end, and timeShift. */
export function generateDoseSchedules(rx: Prescription): DoseSchedule[] {
  if (rx.isDone || !hasConfiguredTimeShift(rx)) return [];

  const intervalHours = frequencyToIntervalHours(rx.frequency);
  const end = endDateTime(rx);
  let cursor = buildFirstDoseAt(rx);
  const doses: DoseSchedule[] = [];
  const now = Date.now();

  while (cursor <= end && doses.length < MAX_DOSES_PER_PRESCRIPTION) {
    const takeAt = toIsoLocal(cursor);
    const isPast = cursor.getTime() < now;

    doses.push({
      id: localDoseId(rx.id, cursor),
      prescriptionId: rx.id,
      takeAt,
      scheduledTime: extractHHMM(takeAt),
      status: isPast ? "missed" : "pending",
      syncStatus: "local",
    });

    cursor = new Date(cursor.getTime() + intervalHours * 60 * 60 * 1000);
  }

  return doses;
}

/** Re-attach existing taken state when regenerating schedules after edit. */
export function mergeDoseSchedules(
  generated: DoseSchedule[],
  previous: DoseSchedule[],
): DoseSchedule[] {
  const takenByTakeAt = new Map<string, DoseSchedule>();
  for (const dose of previous) {
    if (dose.status === "taken" && dose.takeAt) {
      takenByTakeAt.set(dose.takeAt, dose);
    }
  }

  return generated.map((dose) => {
    const prev = dose.takeAt ? takenByTakeAt.get(dose.takeAt) : undefined;
    if (!prev) return dose;
    return {
      ...dose,
      id: prev.id,
      status: "taken",
      takenAt: prev.takenAt,
      patientNote: prev.patientNote,
      serverId: prev.serverId,
      syncStatus: prev.syncStatus ?? dose.syncStatus,
    };
  });
}
