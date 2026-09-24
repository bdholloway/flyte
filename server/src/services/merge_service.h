#ifndef MERGE_SERVICE_H
#define MERGE_SERVICE_H

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
class MergeService
{

public:
    MergeService(const AeroDataBoxClient& schedule, const OpenSkyClient& telemetry);
    std::optional<models::FlightData> lookupFlight(const std::string& flightNumber) const;

private:
    const AeroDataBoxClient& schedule_;
    const OpenSkyClient& telemetry_;
};


} // end namespace services

#endif
