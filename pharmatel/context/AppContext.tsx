import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type {
  DiaryEntry,
  DoseSchedule,
  ObservationSession,
  Patient,
  Prescription,
  SymptomDefinition,
} from "@/models";
import {
  addPrescription,
  deleteObservationSession,
  deleteDiaryEntry,
  getDiaryEntries,
  getAuthToken,
  getObservationSessionByDose,
  getObservationSessions,
  getPrescriptions,
  getSymptomDefinitions,
  login as loginService,
  logout as logoutService,
  removePrescription,
  register as registerService,
  saveObservationSession,
  saveDiaryEntry,
  updatePrescription,
  updateDoseSchedule,
} from "@/services/storage";
import {
  cancelAllDoseNotifications,
  syncDoseReminderNotifications,
} from "@/services/doseNotifications";
import {
  handleDoseNotificationAction,
  setIncomingDoseNotification,
} from "@/notificationTasks";

interface AppContextValue {
  patient: Patient | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  prescriptions: Prescription[];
  observationSessions: ObservationSession[];
  diaryEntries: DiaryEntry[];
  currentDoseNotification: {
    notification: Notifications.Notification;
    prescriptionId: string;
    doseScheduleId: string;
  } | null;
  dismissDoseNotification: () => void;
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (input: {
    username: string;
    password: string;
    role: "PATIENT" | "PHARMACY";
    name?: string;
    email?: string;
    phoneNumber?: string;
    pharmacyName?: string;
    pharmacistName?: string;
    lat?: number;
    lng?: number;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  markDoseTaken: (
    prescriptionId: string,
    doseScheduleId: string,
    note?: string,
  ) => Promise<void>;
  refreshPrescriptions: () => Promise<void>;
  saveObservation: (session: ObservationSession) => Promise<void>;
  removeObservationSession: (sessionId: string) => Promise<void>;
  getSessionForDose: (
    doseScheduleId: string,
  ) => Promise<ObservationSession | null>;
  symptomDefinitions: SymptomDefinition[];
  addDiaryEntry: (entry: DiaryEntry) => Promise<void>;
  updateDiaryEntry: (entry: DiaryEntry) => Promise<void>;
  removeDiaryEntry: (entryId: string) => Promise<void>;
  addUserPrescription: (prescription: Prescription) => Promise<void>;
  updateUserPrescription: (
    prescriptionId: string,
    prescription: Prescription,
  ) => Promise<void>;
  deleteUserPrescription: (prescriptionId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentDoseNotification, setCurrentDoseNotification] = useState<{
    notification: Notifications.Notification;
    prescriptionId: string;
    doseScheduleId: string;
  } | null>(null);

  const prescriptionsKey = ["app", "prescriptions", patient?.id] as const;
  const observationSessionsKey = [
    "app",
    "observationSessions",
    patient?.id,
  ] as const;
  const diaryEntriesKey = ["app", "diaryEntries", patient?.id] as const;
  const symptomDefinitionsKey = [
    "app",
    "symptomDefinitions",
    patient?.id,
  ] as const;

  const prescriptionsQuery = useQuery<Prescription[]>({
    queryKey: prescriptionsKey,
    queryFn: getPrescriptions,
    enabled: isAuthenticated,
  });

  const observationSessionsQuery = useQuery<ObservationSession[]>({
    queryKey: observationSessionsKey,
    queryFn: getObservationSessions,
    enabled: isAuthenticated,
  });

  const diaryEntriesQuery = useQuery<DiaryEntry[]>({
    queryKey: diaryEntriesKey,
    queryFn: getDiaryEntries,
    enabled: isAuthenticated,
  });

  const symptomDefinitionsQuery = useQuery<SymptomDefinition[]>({
    queryKey: symptomDefinitionsKey,
    queryFn: getSymptomDefinitions,
    enabled: isAuthenticated,
  });

  const prescriptions = prescriptionsQuery.data ?? [];
  const observationSessions = observationSessionsQuery.data ?? [];
  const diaryEntries = diaryEntriesQuery.data ?? [];
  const symptomDefinitions = symptomDefinitionsQuery.data ?? [];

  const isLoading =
    isAuthChecking ||
    (isAuthenticated &&
      (prescriptionsQuery.isPending ||
        observationSessionsQuery.isPending ||
        diaryEntriesQuery.isPending ||
        symptomDefinitionsQuery.isPending));

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void syncDoseReminderNotifications(prescriptions);
  }, [isAuthenticated, prescriptions]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const applyAction = async (
      response: Notifications.NotificationResponse,
    ) => {
      console.log("Notification response received:", response);
      const data = response.notification.request.content.data;
      if (
        data &&
        typeof data === "object" &&
        "prescriptionId" in data &&
        "doseScheduleId" in data
      ) {
        const prescriptionId = data.prescriptionId as string;
        const doseScheduleId = data.doseScheduleId as string;
        console.log(
          "Setting current dose notification from response for:",
          prescriptionId,
          doseScheduleId,
        );
        setCurrentDoseNotification({
          notification: response.notification,
          prescriptionId,
          doseScheduleId,
        });
        setIncomingDoseNotification({
          notification: response.notification,
          prescriptionId,
          doseScheduleId,
        });
      }
      const handled = await handleDoseNotificationAction(response);
      if (handled) {
        await queryClient.invalidateQueries({ queryKey: prescriptionsKey });
        setCurrentDoseNotification(null);
      }
    };

    const handleForegroundNotification = async (
      notification: Notifications.Notification,
    ) => {
      console.log("Foreground notification received:", notification);
      const data = notification.request.content.data;
      if (
        data &&
        typeof data === "object" &&
        "prescriptionId" in data &&
        "doseScheduleId" in data
      ) {
        const prescriptionId = data.prescriptionId as string;
        const doseScheduleId = data.doseScheduleId as string;
        console.log(
          "Setting current dose notification for:",
          prescriptionId,
          doseScheduleId,
        );
        setCurrentDoseNotification({
          notification,
          prescriptionId,
          doseScheduleId,
        });
        setIncomingDoseNotification({
          notification,
          prescriptionId,
          doseScheduleId,
        });
      }
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log("Last notification response:", response);
        void applyAction(response);
      }
    });

    const notificationSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        void handleForegroundNotification(notification);
      },
    );

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void applyAction(response);
      },
    );

    return () => {
      notificationSub.remove();
      responseSub.remove();
    };
  }, [isAuthenticated, prescriptionsKey, queryClient]);

  const checkAuth = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const patientStr = await AsyncStorage.getItem("patient");
        if (patientStr) {
          setPatient(JSON.parse(patientStr));
          setIsAuthenticated(true);
        }
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginService(username, password);
    if (result.success) {
      const patientStr = await AsyncStorage.getItem("patient");
      if (patientStr) setPatient(JSON.parse(patientStr));
      setIsAuthenticated(true);
      await queryClient.invalidateQueries({ queryKey: ["app"] });
    }
    return result;
  }, [queryClient]);

  const register = useCallback(
    async (input: {
      username: string;
      password: string;
      role: "PATIENT" | "PHARMACY";
      name?: string;
      email?: string;
      phoneNumber?: string;
      pharmacyName?: string;
      pharmacistName?: string;
      lat?: number;
      lng?: number;
    }) => {
      const result = await registerService(input);
      if (result.success && input.role === "PATIENT") {
        const patientStr = await AsyncStorage.getItem("patient");
        if (patientStr) setPatient(JSON.parse(patientStr));
        setIsAuthenticated(true);
        await queryClient.invalidateQueries({ queryKey: ["app"] });
      }
      return result;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await cancelAllDoseNotifications();
    await logoutService();
    setPatient(null);
    setIsAuthenticated(false);
    queryClient.removeQueries({ queryKey: ["app"] });
  }, [queryClient]);

  const markDoseTakenMutation = useMutation({
    mutationFn: ({
      prescriptionId,
      doseScheduleId,
      note,
    }: {
      prescriptionId: string;
      doseScheduleId: string;
      note?: string;
    }) => {
      const updates: Partial<DoseSchedule> = {
        status: "taken",
        takenAt: new Date().toISOString(),
        patientNote: note,
      };
      return updateDoseSchedule(prescriptionId, doseScheduleId, updates);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(prescriptionsKey, updated);
    },
  });

  const saveObservationMutation = useMutation({
    mutationFn: saveObservationSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: observationSessionsKey });
    },
  });

  const removeObservationMutation = useMutation({
    mutationFn: deleteObservationSession,
    onSuccess: (updated) => {
      queryClient.setQueryData(observationSessionsKey, updated);
    },
  });

  const saveDiaryEntryMutation = useMutation({
    mutationFn: saveDiaryEntry,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: diaryEntriesKey });
    },
  });

  const removeDiaryEntryMutation = useMutation({
    mutationFn: deleteDiaryEntry,
    onSuccess: async (_, entryId) => {
      queryClient.setQueryData<DiaryEntry[]>(diaryEntriesKey, (prev = []) =>
        prev.filter((entry) => entry.id !== entryId),
      );
      await queryClient.invalidateQueries({ queryKey: diaryEntriesKey });
    },
  });

  const addPrescriptionMutation = useMutation({
    mutationFn: addPrescription,
    onSuccess: (updated) => {
      queryClient.setQueryData(prescriptionsKey, updated);
    },
  });

  const deletePrescriptionMutation = useMutation({
    mutationFn: removePrescription,
    onSuccess: (updated) => {
      queryClient.setQueryData(prescriptionsKey, updated);
    },
  });

  const updatePrescriptionMutation = useMutation({
    mutationFn: ({
      prescriptionId,
      prescription,
    }: {
      prescriptionId: string;
      prescription: Prescription;
    }) => updatePrescription(prescriptionId, prescription),
    onSuccess: (updated) => {
      queryClient.setQueryData(prescriptionsKey, updated);
    },
  });

  const markDoseTaken = useCallback(
    async (prescriptionId: string, doseScheduleId: string, note?: string) => {
      await markDoseTakenMutation.mutateAsync({
        prescriptionId,
        doseScheduleId,
        note,
      });
    },
    [markDoseTakenMutation],
  );

  const refreshPrescriptions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: prescriptionsKey });
  }, [prescriptionsKey, queryClient]);

  const saveObservation = useCallback(async (session: ObservationSession) => {
    await saveObservationMutation.mutateAsync(session);
  }, [saveObservationMutation]);

  const removeObservationSession = useCallback(async (sessionId: string) => {
    await removeObservationMutation.mutateAsync(sessionId);
  }, [removeObservationMutation]);

  const getSessionForDose = useCallback(async (doseScheduleId: string) => {
    const cached = (queryClient.getQueryData<ObservationSession[]>(
      observationSessionsKey,
    ) ?? [])
      .find((session) => session.doseScheduleId === doseScheduleId);
    if (cached) return cached;
    return getObservationSessionByDose(doseScheduleId);
  }, [observationSessionsKey, queryClient]);

  const addDiaryEntry = useCallback(async (entry: DiaryEntry) => {
    await saveDiaryEntryMutation.mutateAsync(entry);
  }, [saveDiaryEntryMutation]);

  const updateDiaryEntry = useCallback(async (entry: DiaryEntry) => {
    await saveDiaryEntryMutation.mutateAsync(entry);
  }, [saveDiaryEntryMutation]);

  const removeDiaryEntry = useCallback(async (entryId: string) => {
    await removeDiaryEntryMutation.mutateAsync(entryId);
  }, [removeDiaryEntryMutation]);

  const addUserPrescription = useCallback(
    async (prescription: Prescription) => {
      await addPrescriptionMutation.mutateAsync(prescription);
    },
    [addPrescriptionMutation],
  );

  const deleteUserPrescription = useCallback(async (prescriptionId: string) => {
    await deletePrescriptionMutation.mutateAsync(prescriptionId);
  }, [deletePrescriptionMutation]);

  const updateUserPrescription = useCallback(
    async (prescriptionId: string, prescription: Prescription) => {
      await updatePrescriptionMutation.mutateAsync({
        prescriptionId,
        prescription,
      });
    },
    [updatePrescriptionMutation],
  );

  const dismissDoseNotification = useCallback(() => {
    setCurrentDoseNotification(null);
    setIncomingDoseNotification(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        patient,
        isAuthenticated,
        isLoading,
        prescriptions,
        observationSessions,
        diaryEntries,
        currentDoseNotification,
        dismissDoseNotification,
        login,
        logout,
        markDoseTaken,
        refreshPrescriptions,
        saveObservation,
        removeObservationSession,
        getSessionForDose,
        symptomDefinitions,
        register,
        addDiaryEntry,
        updateDiaryEntry,
        removeDiaryEntry,
        addUserPrescription,
        updateUserPrescription,
        deleteUserPrescription,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
