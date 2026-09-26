#ifndef MERGE_SERVICE_H
#define MERGE_SERVICE_H

#include "cache/ttl_cache.h"
#include "models/flight_data.h"
#include "services/aerodatabox_client.h"
#include "services/opensky_client.h"
#include <optional>
#include <string>

namespace services
{

// Builds the final FlightData: schedule from AeroDataBox, then (only if the
// flight is airborne) telemetry from OpenSky, with etaMinutes computed from
// the AeroDataBox arrival time since OpenSky has no ETA of its own.
// Both upstream calls sit behind a TTL cache to stay inside the free tiers,
// which is what makes the frequently polled /live endpoint cheap.
class MergeService
{

public:
    MergeService(const AeroDataBoxClient& schedule, const OpenSkyClient& telemetry);
    std::optional<models::FlightData> lookupFlight(const std::string& flightNumber) const;
    std::optional<models::LiveUpdate> lookupLive(const std::string& flightNumber) const;

private:
    std::optional<FlightSchedule> cachedSchedule(const std::string& flightNumber) const;
    std::optional<models::Telemetry> cachedTelemetry(const std::string& icao24) const;

    const AeroDataBoxClient& schedule_;
    const OpenSkyClient& telemetry_;

    mutable cache::TtlCache<std::string, FlightSchedule> scheduleCache_;
    mutable cache::TtlCache<std::string, std::optional<models::Telemetry>> telemetryCache_;
};


} // end namespace services

#endif
