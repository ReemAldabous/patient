import axios from "axios";

const DEFAULT_API_BASE_URL = "http://192.168.1.5:8080/api";

export function getApiBaseUrl(): string {
  const envBaseUrl =
    typeof globalThis !== "undefined"
      ? (
          globalThis as unknown as {
            process?: { env?: Record<string, string | undefined> };
          }
        ).process?.env?.EXPO_PUBLIC_API_URL
      : undefined;

  return (envBaseUrl?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const rawHeaders = (options.headers as Record<string, string>) || {};
  const headers: Record<string, string> = { ...rawHeaders };
  headers["Accept"] = "application/json";

  const bodyIsFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !bodyIsFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${getApiBaseUrl()}${path}`;
  const method = (options.method ?? "GET") as any;
  const axiosConfig: any = {
    url,
    method,
    headers,
    data: options.body,
    validateStatus: () => true,
  };

  try {
    const response = await axios.request(axiosConfig);

    if (response.status >= 400) {
      const respData = response.data;
      let errorText = response.statusText || "Request failed";
      try {
        if (typeof respData === "string") errorText = respData;
        else if (respData && typeof respData === "object")
          errorText = JSON.stringify(respData);
      } catch {}
      throw new ApiError(errorText, response.status);
    }

    if (response.status === 204) return undefined as T;

    const resp = response.data;
    if (resp === "" || resp == null) return undefined as T;
    return resp as T;
  } catch (err: any) {
    if (err && err.isAxiosError) {
      const status = err.response?.status ?? 0;
      const respData = err.response?.data;
      let errorText = err.message ?? "Request failed";
      try {
        if (typeof respData === "string") errorText = respData;
        else if (respData && typeof respData === "object")
          errorText = JSON.stringify(respData);
      } catch {}
      throw new ApiError(errorText, status);
    }
    throw err;
  }
}
