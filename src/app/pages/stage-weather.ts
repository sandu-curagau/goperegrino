import { dateInput, plusDays, Point } from '../demo/models';

export interface StageWeather {
  temperature: number;
  icon: string;
  simulated: boolean;
  hours: { time: string; temperature: number; rain: number; wind: number; icon: string }[];
  days: { date: string; low: number; high: number; rain: number; icon: string }[];
}

function weatherIcon(code: number): string {
  if (code === 0) return 'sunny-outline';
  return code < 50 ? 'partly-sunny-outline' : 'rainy-outline';
}

export function sampleWeather(stageId: number): StageWeather {
  const temperature = 15 + (stageId % 7);
  const now = new Date();
  const rain = stageId % 3 === 0 ? 65 : 15;
  return {
    temperature,
    icon: weatherIcon(2),
    simulated: true,
    hours: Array.from({ length: 6 }, (_, index) => ({
      time: String((now.getHours() + index + 1) % 24).padStart(2, '0') + ':00',
      temperature: temperature + Math.min(index, 5 - index),
      rain: Math.min(100, rain + index * 4),
      wind: 9 + index * 2,
      icon: weatherIcon(rain > 50 ? 61 : 2),
    })),
    days: Array.from({ length: 3 }, (_, index) => ({
      date: plusDays(dateInput(now), index),
      low: temperature - 6 + index,
      high: temperature + 3 + index,
      rain: Math.min(100, rain + index * 10),
      icon: weatherIcon(rain + index * 10 > 50 ? 61 : 2),
    })),
  };
}

interface WeatherResponse {
  current?: { temperature_2m: number; time: string; weather_code: number };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
  };
}

export async function fetchStageWeather(
  [longitude, latitude]: Point,
  signal: AbortSignal,
): Promise<StageWeather | undefined> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: 'auto',
    forecast_days: '3',
    current: 'temperature_2m,weather_code',
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
    daily: 'temperature_2m_min,temperature_2m_max,precipitation_probability_max,weather_code',
  });
  const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  });
  if (!response.ok) return;
  const { current, hourly, daily }: WeatherResponse = await response.json();
  if (!current || !hourly || !daily || !Number.isFinite(current.temperature_2m)) return;
  const firstHour = hourly.time.findIndex((time) => time > current.time);
  const hours =
    firstHour < 0
      ? []
      : hourly.time.slice(firstHour, firstHour + 6).map((time, offset) => {
          const index = firstHour + offset;
          return {
            time: time.slice(11),
            temperature: Math.round(hourly.temperature_2m[index]),
            rain: hourly.precipitation_probability[index],
            wind: Math.round(hourly.wind_speed_10m[index]),
            icon: weatherIcon(hourly.weather_code[index]),
          };
        });
  const days = daily.time.map((date, index) => ({
    date,
    low: Math.round(daily.temperature_2m_min[index]),
    high: Math.round(daily.temperature_2m_max[index]),
    rain: daily.precipitation_probability_max[index],
    icon: weatherIcon(daily.weather_code[index]),
  }));
  if (!hours.length || !days.length) return;
  return {
    temperature: Math.round(current.temperature_2m),
    icon: weatherIcon(current.weather_code),
    simulated: false,
    hours,
    days,
  };
}
