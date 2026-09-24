#include "merge_service.h"

#include <algorithm>
#include <chrono>

namespace services
{

MergeService::MergeService(const AeroDataBoxClient& schedule, const OpenSkyClient& telemetry)
    : schedule_(schedule), telemetry_(telemetry)
{
}

std::optional<models::FlightData> MergeService::lookupFlight(const std::string& flightNumber) const
{
    std::optional<FlightSchedule> schedule = schedule_.lookupFlight(flightNumber);
    if (!schedule) return std::nullopt;

    models::FlightData data = std::move(schedule->flight);

    // Don't burn OpenSky quota on flights that are on the ground. No icao24 means
    // there's nothing to look up by; telemetry just stays null for the UI.
    if (!schedule->airborne || !data.icao24) return data;

    std::optional<models::Telemetry> telemetry = telemetry_.lookupTelemetry(*data.icao24);
    if (!telemetry) return data; // no ADS-B coverage right now — not an error

    if (schedule->arrivalUtc)
    {
        auto remaining = std::chrono::duration_cast<std::chrono::minutes>(
            *schedule->arrivalUtc - std::chrono::system_clock::now()).count();
        telemetry->etaMinutes = static_cast<int>(std::max<long long>(remaining, 0));
    }

    data.telemetry = telemetry;
    return data;
}


} // end namespace services
