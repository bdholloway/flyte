#include "opensky_client.h"
#include "http_client.h"

#include <nlohmann/json.hpp>

#include <algorithm>
#include <cctype>
#include <ctime>
#include <iostream>

namespace services
{

namespace {

// states[i] is a heterogeneous array per the OpenSky states/all schema; several
// fields (altitude, velocity, track...) can be JSON null when the aircraft isn't
// reporting that field yet.
template <typename T>
std::optional<T> stateField(const nlohmann::json& row, size_t idx) {
    if (idx >= row.size() || row.at(idx).is_null()) return std::nullopt;
    return row.at(idx).get<T>();
}

std::string formatIso8601(std::time_t t) {
    std::tm tm{};
    gmtime_r(&t, &tm);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
    return buf;
}

} // anonymous namespace

OpenSkyClient::OpenSkyClient(std::string clientId, std::string clientSecret)
    : clientId_(std::move(clientId)), clientSecret_(std::move(clientSecret))
{
}

std::string OpenSkyClient::getAccessToken() const
{
    std::lock_guard<std::mutex> lock(tokenMutex_);
    
    if(!cachedToken_.empty())
    {
        if(std::chrono::system_clock::now() < (tokenExpiry_ - std::chrono::seconds(60)))
        {
            return cachedToken_;
        }
    }

    std::string body = "grant_type=client_credentials&client_id=" + http::urlEncode(clientId_) +
                        "&client_secret=" + http::urlEncode(clientSecret_);

    auto response = http::postForm(
        "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
        body, "[OpenSkyClient] token request");
    if (!response) {
        return "";
    }

    try {
        nlohmann::json parsed = nlohmann::json::parse(*response);
        cachedToken_ = parsed.at("access_token").get<std::string>();
        int expiresIn = parsed.value("expires_in", 1800); // OpenSky tokens live ~30min; fall back to that
        tokenExpiry_ = std::chrono::system_clock::now() + std::chrono::seconds(expiresIn);
        return cachedToken_;
    } catch (const nlohmann::json::exception&) {
        std::cerr << "[OpenSkyClient] token response malformed: " << *response << std::endl;
        return "";
    }
}

std::optional<models::Telemetry> OpenSkyClient::lookupTelemetry(const std::string& icao24) const
{
    std::string token = getAccessToken();
    if (token.empty()) return std::nullopt;

    // AeroDataBox's aircraft.modeS comes back uppercase; OpenSky requires lowercase.
    std::string lower = icao24;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                    [](unsigned char c) { return std::tolower(c); });

    std::string url = "https://opensky-network.org/api/states/all?icao24=" + lower;
    auto body = http::get(url, {"Authorization: Bearer " + token}, "[OpenSkyClient] states request");
    if (!body) return std::nullopt;

    try {
        nlohmann::json parsed = nlohmann::json::parse(*body);
        if (!parsed.contains("states") || parsed.at("states").is_null()) {
            return std::nullopt; // aircraft not currently transmitting/airborne
        }
        const nlohmann::json& states = parsed.at("states");
        if (!states.is_array() || states.empty()) return std::nullopt;
        const nlohmann::json& row = states.at(0);

        auto baroAltitude = stateField<double>(row, 7);
        auto geoAltitude = stateField<double>(row, 13);
        if (!baroAltitude && !geoAltitude) return std::nullopt; // no usable altitude yet

        models::Telemetry telemetry;
        telemetry.altitude = (baroAltitude ? *baroAltitude : *geoAltitude) * 3.28084; // m -> ft
        telemetry.speed = stateField<double>(row, 9).value_or(0.0) * 2.23694;         // m/s -> mph
        telemetry.heading = stateField<double>(row, 10).value_or(0.0);                // deg, no conversion

        auto timePosition = stateField<long long>(row, 3);
        auto lastContact = stateField<long long>(row, 4);
        long long timestamp = timePosition.value_or(lastContact.value_or(0));
        telemetry.lastUpdated = timestamp > 0 ? formatIso8601(static_cast<std::time_t>(timestamp)) : "";

        // OpenSky has no ETA field. OpenSkyClient is telemetry-only by design — the
        // caller combines this with the AeroDataBox arrival time to compute etaMinutes.
        telemetry.etaMinutes = 0;

        return telemetry;
    } catch (const nlohmann::json::exception&) {
        std::cerr << "[OpenSkyClient] states response malformed: " << *body << std::endl;
        return std::nullopt;
    }
}


} //end namespace services