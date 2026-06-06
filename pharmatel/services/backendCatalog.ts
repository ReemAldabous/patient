import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Medicine, Pharmacy } from "@/models";
import { apiRequest } from "./api";

type ApiPageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

type ApiMedicineDto = {
  id: number;
  name: string;
  pharmaceuticalForm?: string | null;
  box?: number | string | null;
  capacity?: number | string | null;
  capacityMetric?: string | null;
};

type ApiPharmacyDto = {
  id: number;
  name: string;
  pharmacistName?: string | null;
  address?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  lat?: number | null;
  lng?: number | null;
  location?: unknown;
};

type ApiPharmacyMedicineDto = {
  pharmacyMedicineId: number;
  medicineId: number;
  medicineName: string;
  quantity: number;
};

type NearbyParams = {
  lat: number;
  lng: number;
};

type LocationLike = {
  x?: unknown;
  y?: unknown;
  coordinates?: unknown;
};

export type SearchableMedicine = {
  id: string;
  name: string;
  genericName: string;
  category: string;
  strength: string;
  dosageForm: Medicine["dosageForm"];
};

const AUTH_TOKEN_KEY = "auth_token";
export const DEFAULT_NEARBY_PARAMS: NearbyParams = {
  lat: 40.7389,
  lng: -73.9903,
};

function haversineDistanceKm(from: NearbyParams, to: NearbyParams): number {
  const earthRadiusKm = 6371;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.max(100, Math.round(distanceKm * 1000))} m`;
  }

  return `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km`;
}

function fallbackCoordinates(index: number): { lat: number; lng: number } {
  const angle = ((index % 8) * Math.PI) / 4;
  const radius = 0.01 + (index % 3) * 0.004;
  return {
    lat: DEFAULT_NEARBY_PARAMS.lat + Math.sin(angle) * radius,
    lng: DEFAULT_NEARBY_PARAMS.lng + Math.cos(angle) * radius,
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractLocationCoordinates(location: unknown): {
  lat: number | null;
  lng: number | null;
} {
  if (!location || typeof location !== "object") {
    return { lat: null, lng: null };
  }

  const candidate = location as LocationLike;
  const x = toNumber(candidate.x);
  const y = toNumber(candidate.y);
  if (x != null && y != null) {
    return { lat: y, lng: x };
  }

  const coordinates = candidate.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = toNumber(coordinates[0]);
    const lat = toNumber(coordinates[1]);
    if (lat != null && lng != null) {
      return { lat, lng };
    }
  }

  return { lat: null, lng: null };
}

function mapDosageForm(value?: string | null): Medicine["dosageForm"] {
  const form = (value ?? "tablet").toLowerCase();
  if (form.includes("capsule")) return "capsule";
  if (
    form.includes("liquid") ||
    form.includes("syrup") ||
    form.includes("solution")
  )
    return "liquid";
  if (form.includes("injection")) return "injection";
  if (
    form.includes("cream") ||
    form.includes("ointment") ||
    form.includes("gel")
  )
    return "cream";
  if (form.includes("inhal")) return "inhaler";
  return "tablet";
}

function mapStrength(dto: ApiMedicineDto): string {
  const parts = [dto.capacity, dto.capacityMetric].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  if (dto.box != null) {
    return `${dto.box} units`;
  }
  return "Unknown";
}

function mapMedicine(dto: ApiMedicineDto): SearchableMedicine {
  const category = dto.pharmaceuticalForm?.trim() || "Medication";
  return {
    id: String(dto.id),
    name: dto.name,
    genericName: dto.name,
    category,
    strength: mapStrength(dto),
    dosageForm: mapDosageForm(dto.pharmaceuticalForm),
  };
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function fetchMedicinesCatalog(
  query: string,
  size = 100,
): Promise<SearchableMedicine[]> {
  const token = await getToken();
  const search = query.trim();
  const params = new URLSearchParams({
    page: "0",
    size: String(size),
  });
  if (search) params.set("name", search);

  const response = await apiRequest<ApiPageResponse<ApiMedicineDto>>(
    `/medicines?${params}`,
    {},
    token,
  );

  return response.content.map(mapMedicine);
}

export async function fetchPharmaciesForMedicine(
  medicineId: string,
  userLocation: NearbyParams = DEFAULT_NEARBY_PARAMS,
): Promise<Pharmacy[]> {
  const numericMedicineId = Number.parseInt(medicineId, 10);
  if (!Number.isFinite(numericMedicineId)) {
    return [];
  }

  const token = await getToken();
  const params = new URLSearchParams({
    lat: String(userLocation.lat),
    lng: String(userLocation.lng),
  });

  const nearby = await apiRequest<ApiPharmacyDto[]>(
    `/pharmacies/nearby?${params}`,
    {},
    token,
  );

  if (nearby.length === 0) {
    return [];
  }
  console.log(nearby);
  const medicineByPharmacyId = new Map<number, ApiPharmacyMedicineDto>();
  await Promise.all(
    nearby.map(async (pharmacy) => {
      try {
        const medicinesPage = await apiRequest<
          ApiPageResponse<ApiPharmacyMedicineDto>
        >(
          `/pharmacies/${pharmacy.id}/medicines?page=0&size=200`,
          {},
          token,
        );

        const match = medicinesPage.content.find(
          (item) => item.medicineId === numericMedicineId,
        );
        if (match) {
          medicineByPharmacyId.set(pharmacy.id, match);
        }
      } catch {
        // Keep this pharmacy in the list as out-of-stock when inventory lookup fails.
      }
    }),
  );

  return nearby
    .map((pharmacy, index) => {
      const match = medicineByPharmacyId.get(pharmacy.id);
      const locationCoordinates = extractLocationCoordinates(pharmacy.location);
      const pharmacyLat = pharmacy.lat ?? locationCoordinates.lat;
      const pharmacyLng = pharmacy.lng ?? locationCoordinates.lng;

      const fallback = fallbackCoordinates(index);
      const hasCoordinates = pharmacyLat != null && pharmacyLng != null;
      const lat = hasCoordinates ? pharmacyLat : fallback.lat;
      const lng = hasCoordinates ? pharmacyLng : fallback.lng;
      const distanceKm = hasCoordinates
        ? haversineDistanceKm(userLocation, { lat, lng })
        : undefined;

      return {
        id: String(pharmacy.id),
        name: pharmacy.name,
        pharmacistName: pharmacy.pharmacistName ?? undefined,
        address: pharmacy.address ?? undefined,
        phone: pharmacy.phone ?? pharmacy.phoneNumber ?? undefined,
        lat,
        lng,
        distance: distanceKm != null ? formatDistance(distanceKm) : undefined,
        inStock: (match?.quantity ?? 0) > 0,
        quantity: match?.quantity ?? 0,
        _distanceKm: distanceKm,
      } as Pharmacy & { _distanceKm?: number };
    })
    .sort((a, b) => {
      if (
        a._distanceKm != null &&
        b._distanceKm != null &&
        a._distanceKm !== b._distanceKm
      ) {
        return a._distanceKm - b._distanceKm;
      }
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      return (b.quantity ?? 0) - (a.quantity ?? 0);
    })
    .map(({ _distanceKm, ...pharmacy }) => pharmacy);
}
