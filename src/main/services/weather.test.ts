import { describe, it, expect, afterEach, vi } from 'vitest'
import { describeWeatherCode, getWeather } from './weather'

describe('describeWeatherCode', () => {
  it('describes known WMO codes', () => {
    expect(describeWeatherCode(0)).toBe('clear sky')
    expect(describeWeatherCode(61)).toBe('slight rain')
    expect(describeWeatherCode(95)).toBe('thunderstorm')
  })

  it('falls back gracefully for unknown codes', () => {
    expect(describeWeatherCode(-1)).toBe('unknown conditions (code -1)')
  })
})

describe('getWeather', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns a formatted summary for a valid location', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ latitude: 28.65, longitude: 77.23, name: 'Delhi', country: 'India' }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            temperature_2m: 27.8,
            relative_humidity_2m: 91,
            weather_code: 51,
            wind_speed_10m: 6.7
          },
          daily: {
            time: ['2026-08-03', '2026-08-04'],
            weather_code: [96, 3],
            temperature_2m_max: [34.1, 30.3],
            temperature_2m_min: [27.1, 25.9]
          }
        })
      })

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await getWeather('Delhi')

    expect(result).toContain('Delhi, India')
    expect(result).toContain('light drizzle')
    expect(result).toContain('27.8°C')
    expect(result).toContain('2026-08-03')
    expect(result).toContain('thunderstorm with slight hail')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('geocoding-api.open-meteo.com')
    expect(fetchMock.mock.calls[1][0]).toContain('api.open-meteo.com/v1/forecast')
  })

  it('returns an error string when the location cannot be found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] })
    }) as unknown as typeof fetch

    const result = await getWeather('Nowhereville')
    expect(result).toBe('Error: could not find a location named "Nowhereville".')
  })

  it('throws when the geocoding request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    await expect(getWeather('Delhi')).rejects.toThrow('Geocoding request failed')
  })

  it('throws when the forecast request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ latitude: 28.65, longitude: 77.23, name: 'Delhi', country: 'India' }]
        })
      })
      .mockResolvedValueOnce({ ok: false, status: 503 })

    global.fetch = fetchMock as unknown as typeof fetch

    await expect(getWeather('Delhi')).rejects.toThrow('Forecast request failed')
  })
})
