/**
 * Structured API envelope shared by every server function and REST route.
 * { success, message, data }
 */
export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T;
}

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

export function fail(message: string): ApiResponse<null> {
  return { success: false, message, data: null };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function toApiMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function jsonResponse<T>(body: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
