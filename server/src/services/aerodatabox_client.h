#ifndef AERODATABOX_CLIENT_H
#define AERODATABOX_CLIENT_H

#include "models/flight_data.h"
#include <chrono>
#include <optional>
#include <string>

namespace services {

// The schedule half of a flight, plus the extra bits merge_service needs that
// don't belong in the FlightData contract itself.
struct FlightSchedule {
    models::FlightData flight;
    std::optional<std::chrono::system_clock::time_point> arrivalUtc; // revised if known, else scheduled
    bool airborne = false; // raw AeroDataBox status says the aircraft is in the air
};

class AeroDataBoxClient {
public:
    explicit AeroDataBoxClient(std::string apiKey);
    std::optional<FlightSchedule> lookupFlight(const std::string& flightNumber) const;

private:
    std::string apiKey_;
};

} // namespace services

#endif