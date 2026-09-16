#ifndef AERODATABOX_CLIENT_H
#define AERODATABOX_CLIENT_H

#include "models/flight_data.h"
#include <optional>
#include <string>

namespace services {

class AeroDataBoxClient {
public:
    explicit AeroDataBoxClient(std::string apiKey);
    std::optional<models::FlightData> lookupFlight(const std::string& flightNumber) const;

private:
    std::string apiKey_;
};

} // namespace services

#endif