import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ok, type ApiResponse } from "@/lib/api-response";
import { fetchWeather, geocodeLocation, type WeatherOutcome } from "@/lib/weather.server";

/**
 * Weather API:
 *   GET /api/v1/weather?location=Mumbai&days=7 — current + forecast from Open-Meteo
 */

export const getWeather = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        location: z.string().trim().min(2).max(120),
        days: z.number().int().min(1).max(7).default(7),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ApiResponse<WeatherOutcome | null>> => {
    const hit = await geocodeLocation(data.location);
    if (!hit) {
      return ok(null, `I couldn't find a place called "${data.location}". Check the spelling or add a region.`);
    }
    const weather = await fetchWeather(hit, data.days);
    const place = [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");
    return ok(weather, `Weather for ${place}`);
  });
