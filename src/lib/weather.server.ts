/**
 * Weather Intelligence — server-side Open-Meteo integration.
 * Free, keyless provider. All numbers come from the API; nothing is estimated.
 */

export interface WeatherLocation {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WeatherCurrent {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  condition: string;
}

export interface WeatherDay {
  date: string;
  min: number;
  max: number;
  rainProbability: number;
  uvIndex: number;
  condition: string;
}

export interface WeatherOutcome {
  location: WeatherLocation;
  observationTime: string;
  current: WeatherCurrent;
  today: { min: number; max: number; rainProbability: number; uvIndex: number };
  hourly: { time: string; temperature: number; rainProbability: number }[];
  daily: WeatherDay[];
}

/* WMO weather interpretation codes → plain condition names */
const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
};

function conditionOf(code: number | undefined): string {
  if (code === undefined) return "Unknown";
  return WMO[code] ?? "Unknown";
}

export interface GeocodeHit {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export async function geocodeLocation(query: string): Promise<GeocodeHit | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Location lookup failed (status ${response.status}).`);
  const body = (await response.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone: string }[];
  };
  const hit = body.results?.[0];
  if (!hit) return null;
  return {
    name: hit.name,
    admin1: hit.admin1,
    country: hit.country,
    latitude: hit.latitude,
    longitude: hit.longitude,
    timezone: hit.timezone,
  };
}

interface OpenMeteoForecast {
  timezone: string;
  current?: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
  };
  hourly?: { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[] };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    weather_code: number[];
    uv_index_max: (number | null)[];
  };
}

export async function fetchWeather(hit: GeocodeHit, days = 7): Promise<WeatherOutcome> {
  const forecastDays = Math.min(Math.max(days, 1), 7);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(hit.latitude));
  url.searchParams.set("longitude", String(hit.longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,uv_index_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(forecastDays));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Weather service failed (status ${response.status}).`);
  const body = (await response.json()) as OpenMeteoForecast;

  const current = body.current;
  if (!current || !body.daily?.time.length) throw new Error("Weather service returned no observation data.");

  const daily: WeatherDay[] = body.daily.time.map((date, i) => ({
    date,
    min: body.daily!.temperature_2m_min[i],
    max: body.daily!.temperature_2m_max[i],
    rainProbability: body.daily!.precipitation_probability_max[i] ?? 0,
    uvIndex: body.daily!.uv_index_max[i] ?? 0,
    condition: conditionOf(body.daily!.weather_code[i]),
  }));

  const hourly = (body.hourly?.time ?? []).slice(0, 24).map((time, i) => ({
    time,
    temperature: body.hourly!.temperature_2m[i],
    rainProbability: body.hourly!.precipitation_probability[i] ?? 0,
  }));

  return {
    location: {
      name: hit.name,
      admin1: hit.admin1,
      country: hit.country,
      latitude: hit.latitude,
      longitude: hit.longitude,
      timezone: body.timezone || hit.timezone,
    },
    observationTime: current.time,
    current: {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      precipitation: current.precipitation,
      condition: conditionOf(current.weather_code),
    },
    today: daily[0]
      ? { min: daily[0].min, max: daily[0].max, rainProbability: daily[0].rainProbability, uvIndex: daily[0].uvIndex }
      : { min: current.temperature_2m, max: current.temperature_2m, rainProbability: 0, uvIndex: 0 },
    hourly,
    daily,
  };
}
