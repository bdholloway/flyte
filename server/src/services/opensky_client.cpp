#include "opensky_client.h"

#include <curl/curl.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <cctype>
#include <ctime>
#include <iostream>

namespace services
{

    namespace {

size_t writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    static_cast<std::string*>(userdata)->append(ptr, size * nmemb);
    return size * nmemb;
}

std::optional<std::string> httpPostForm(const std::string& url, const std::string& body) {
    CURL* curl = curl_easy_init();
    if (!curl) return std::nullopt;

    std::string response;
    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/x-www-form-urlencoded");

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

    CURLcode res = curl_easy_perform(curl);
    long httpCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK || httpCode != 200) {
        std::cerr << "[OpenSkyClient] token request failed: curl=" << curl_easy_strerror(res)
                  << " httpCode=" << httpCode << " body=" << response << std::endl;
        return std::nullopt;
    }
    return response;
}

std::optional<std::string> httpGetAuth(const std::string& url, const std::string& token) {
    CURL* curl = curl_easy_init();
    if (!curl) return std::nullopt;

    std::string body;
    struct curl_slist* headers = nullptr;
    std::string authHeader = "Authorization: Bearer " + token;
    headers = curl_slist_append(headers, authHeader.c_str());

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

    CURLcode res = curl_easy_perform(curl);
    long httpCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK || httpCode != 200) {
        std::cerr << "[OpenSkyClient] states request failed: curl=" << curl_easy_strerror(res)
                  << " httpCode=" << httpCode << " body=" << body << std::endl;
        return std::nullopt;
    }
    return body;
}

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

std::string urlEncode(const std::string& value) {
    CURL* curl = curl_easy_init();
    if (!curl) return value;
    char* escaped = curl_easy_escape(curl, value.c_str(), static_cast<int>(value.length()));
    std::string result = escaped ? escaped : value;
    if (escaped) curl_free(escaped);
    curl_easy_cleanup(curl);
    return result;
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

    std::string body = "grant_type=client_credentials&client_id=" + urlEncode(clientId_) +
                        "&client_secret=" + urlEncode(clientSecret_);

    auto response = httpPostForm(
        "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
        body);
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
    auto body = httpGetAuth(url, token);
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