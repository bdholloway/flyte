#ifndef OPENSKY_CLIENT_H
#define OPENSKY_CLIENT_H

#include "models/flight_data.h"
#include <chrono>
#include <mutex>
#include <optional>
#include <string>

namespace services
{

class OpenSkyClient 
{

public:
    OpenSkyClient(std::string clientId, std::string clientSecret);
    std::optional<models::Telemetry> lookupTelemetry(const std::string& icao24) const;

private:
    std::string getAccessToken() const;

    std::string clientId_;
    std::string clientSecret_;

    mutable std::mutex tokenMutex_;
    mutable std::string cachedToken_;
    mutable std::chrono::system_clock::time_point tokenExpiry_;
};


} // end namespace services

#endif