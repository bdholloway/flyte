#include "merge_service.h"

#include <algorithm>
#include <cctype>
#include <chrono>

namespace services
{

namespace {

// Schedules barely change minute to minute; positions do.
constexpr auto kScheduleTtl = std::chrono::seconds(45);
constexpr auto kTelemetryTtl = std::chrono::seconds(5);

// "sq21", "SQ21" and "SQ 21" are the same flight — share one cache entry.
std::string normalizeFlightNumber(const std::string& flightNumber)
{
    std::string key;
    for (char c : flightNumber)
    {
        if (!std::isspace(static_cast<unsigned char>(c)))
            key += static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    }
    return key;
}

} // anonymous namespace

MergeService::MergeService(const AeroDataBoxClient& schedule, const OpenSkyClient& telemetry)
    : schedule_(schedule), telemetry_(telemetry),
      scheduleCache_(kScheduleTtl), telemetryCache_(kTelemetryTtl)
{
}

std::optional<FlightSchedule> MergeService::cachedSchedule(const std::string& flightNumber) const
{
    std::string key = normalizeFlightNumber(flightNumber);
    if (auto hit = scheduleCache_.get(key)) return hit;

    std::optional<FlightSchedule> schedule = schedule_.lookupFlight(flightNumber);
    // Misses aren't cached: AeroDataBox rate-limit 429s also surface as nullopt,
    // and caching those would turn a momentary throttle into a 45s false 404.
    if (schedule) scheduleCache_.put(key, *schedule);
    return schedule;
}

std::optional<models::Telemetry> MergeService::cachedTelemetry(const std::string& icao24) const
{
    if (auto hit = telemetryCache_.get(icao24)) return *hit;

    // nullopt ("no ADS-B coverage right now") is cached too — it's a real answer,
    // and the TTL is short enough that coverage returning is picked up quickly.
    std::optional<models::Telemetry> telemetry = telemetry_.lookupTelemetry(icao24);
    telemetryCache_.put(icao24, telemetry);
    return telemetry;
}

std::optional<models::FlightData> MergeService::lookupFlight(const std::string& flightNumber) const
{
    std::optional<FlightSchedule> schedule = cachedSchedule(flightNumber);
    if (!schedule) return std::nullopt;

    models::FlightData data = std::move(schedule->flight);

    // Don't burn OpenSky quota on flights that are on the ground. No icao24 means
    // there's nothing to look up by; telemetry just stays null for the UI.
    if (!schedule->airborne || !data.icao24) return data;

    std::optional<models::Telemetry> telemetry = cachedTelemetry(*data.icao24);
    if (!telemetry) return data; // no ADS-B coverage right now — not an error

    // Computed per request (not cached) so the countdown stays current even
    // while the schedule itself is served from cache.
    if (schedule->arrivalUtc)
    {
        auto remaining = std::chrono::duration_cast<std::chrono::minutes>(
            *schedule->arrivalUtc - std::chrono::system_clock::now()).count();
        telemetry->etaMinutes = static_cast<int>(std::max<long long>(remaining, 0));
    }

    data.telemetry = telemetry;
    return data;
}

std::optional<models::LiveUpdate> MergeService::lookupLive(const std::string& flightNumber) const
{
    // Same merge as a full lookup: while polling, the schedule is almost always a
    // 45s cache hit and only telemetry (5s TTL) actually goes upstream.
    std::optional<models::FlightData> data = lookupFlight(flightNumber);
    if (!data) return std::nullopt;

    return models::LiveUpdate{data->status, data->progress, std::move(data->telemetry)};
}


} // end namespace services
