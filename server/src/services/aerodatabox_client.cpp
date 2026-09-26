#include "aerodatabox_client.h"

#include <curl/curl.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <chrono>
#include <cctype>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>

namespace services {

namespace {

size_t writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    static_cast<std::string*>(userdata)->append(ptr, size * nmemb);
    return size * nmemb;
}

std::optional<std::string> httpGet(const std::string& url, const std::string& apiKey) {
    CURL* curl = curl_easy_init();
    if (!curl) return std::nullopt;

    std::string body;
    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "x-rapidapi-host: aerodatabox.p.rapidapi.com");
    std::string keyHeader = "x-rapidapi-key: " + apiKey;
    headers = curl_slist_append(headers, keyHeader.c_str());

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
        std::cerr << "[AeroDataBoxClient] request failed: curl=" << curl_easy_strerror(res)
                  << " httpCode=" << httpCode << " body=" << body << std::endl;
        return std::nullopt;
    }
    return body;
}

std::optional<std::chrono::system_clock::time_point> parseUtc(const std::string& s) {
    std::tm tm{};
    std::istringstream ss(s);
    ss >> std::get_time(&tm, "%Y-%m-%d %H:%M");
    if (ss.fail()) return std::nullopt;
    return std::chrono::system_clock::from_time_t(timegm(&tm)); // timegm = POSIX, fine (Docker/Linux-only)
}

std::string formatDuration(std::chrono::system_clock::time_point start,
                            std::chrono::system_clock::time_point end) {
    auto mins = std::chrono::duration_cast<std::chrono::minutes>(end - start).count();
    if (mins < 0) mins = 0;
    return std::to_string(mins / 60) + "h " + std::to_string(mins % 60) + "m";
}

std::optional<std::string> computeDelay(std::optional<std::chrono::system_clock::time_point> scheduled,
                                         std::optional<std::chrono::system_clock::time_point> revised) {
    if (!scheduled || !revised) return std::nullopt;
    auto diff = std::chrono::duration_cast<std::chrono::minutes>(*revised - *scheduled).count();
    if (diff <= 10) return std::nullopt; // not meaningfully delayed
    std::string out;
    if (diff / 60 > 0) out += std::to_string(diff / 60) + "h ";
    return out + std::to_string(diff % 60) + "m"; // bare duration, e.g. "1h 5m" — the UI supplies the wording
}

int computeProgress(models::FlightStatus status,
                     std::optional<std::chrono::system_clock::time_point> dep,
                     std::optional<std::chrono::system_clock::time_point> arr) {
    using models::FlightStatus;
    if (status == FlightStatus::Landed) return 100;
    if (status != FlightStatus::Enroute) return 0;
    if (!dep || !arr || *arr <= *dep) return 50; // can't compute — reasonable midpoint fallback
    auto now = std::chrono::system_clock::now();
    auto total = std::chrono::duration_cast<std::chrono::minutes>(*arr - *dep).count();
    auto elapsed = std::clamp(std::chrono::duration_cast<std::chrono::minutes>(now - *dep).count(), 0L, total);
    return static_cast<int>((elapsed * 100) / total);
}

std::string formatDisplayDate(const std::string& localTimestamp) {
    // localTimestamp like "2026-01-03 15:45-08:00" — take the date portion only;
    // weekday comes from the calendar date, timezone offset doesn't matter for that.
    std::tm tm{};
    std::istringstream ss(localTimestamp.substr(0, 10));
    ss >> std::get_time(&tm, "%Y-%m-%d");
    if (ss.fail()) return "";
    std::time_t t = timegm(&tm);
    std::tm normalized{};
    gmtime_r(&t, &normalized);
    char buf[16];
    std::strftime(buf, sizeof(buf), "%a, %d %b", &normalized);
    return buf;
}

models::FlightStatus mapStatus(const std::string& raw) {
    using models::FlightStatus;
    if (raw == "EnRoute" || raw == "Approaching") return FlightStatus::Enroute;
    if (raw == "CheckIn" || raw == "Boarding" || raw == "GateClosed") return FlightStatus::Boarding;
    if (raw == "Departed") return FlightStatus::Ontime;
    if (raw == "Delayed" || raw == "Diverted" || raw == "CanceledUncertain") return FlightStatus::Delayed;
    if (raw == "Arrived") return FlightStatus::Landed;
    if (raw == "Canceled" || raw == "Cancelled") return FlightStatus::Cancelled;
    return FlightStatus::Scheduled; // Unknown, Expected, and any future/unrecognized value
}

// Checked against the raw status because "Departed" collapses into Ontime/Delayed
// in mapStatus, but the aircraft is still in the air and worth an OpenSky call.
bool isAirborne(const std::string& raw) {
    return raw == "Departed" || raw == "EnRoute" || raw == "Approaching";
}

std::string deriveCallsign(const nlohmann::json& flight) {
    if (flight.contains("callSign")) {
        auto cs = flight.at("callSign").get<std::string>();
        if (!cs.empty()) return cs;
    }
    std::string icaoPrefix = flight.value("/airline/icao"_json_pointer, std::string());
    std::string number = flight.value("number", std::string());
    std::string digits;
    for (char c : number) {
        if (std::isdigit(static_cast<unsigned char>(c))) digits += c;
    }
    return (!icaoPrefix.empty() && !digits.empty()) ? icaoPrefix + digits : number;
}

// A leg's time block ("scheduledTime", "revisedTime", "predictedTime") in the
// given flavour ("utc"/"local"), or "" if absent — in-flight legs can omit
// scheduledTime entirely and only carry predictedTime.
std::string legTime(const nlohmann::json& leg, const char* block, const char* flavour) {
    if (!leg.contains(block)) return "";
    return leg.at(block).value(flavour, std::string());
}

// First non-empty time from the given blocks, in priority order.
std::string firstLegTime(const nlohmann::json& leg, std::initializer_list<const char*> blocks,
                          const char* flavour) {
    for (const char* block : blocks) {
        std::string t = legTime(leg, block, flavour);
        if (!t.empty()) return t;
    }
    return "";
}

// AeroDataBox local timestamps look like "2026-08-18 20:22-07:00" — our contract
// wants just "HH:mm" (matching the UI's existing display format).
std::string extractTimeOfDay(const std::string& localTimestamp) {
    return localTimestamp.size() >= 16 ? localTimestamp.substr(11, 5) : localTimestamp;
}

models::AirportInfo mapAirport(const nlohmann::json& leg) {
    models::AirportInfo info;
    const auto& airport = leg.at("airport");
    info.code = airport.value("iata", std::string());
    info.city = airport.value("municipalityName", std::string());
    info.time = extractTimeOfDay(
        firstLegTime(leg, {"revisedTime", "predictedTime", "scheduledTime"}, "local"));
    if (leg.contains("terminal")) info.terminal = leg.at("terminal").get<std::string>();
    if (leg.contains("gate")) info.gate = leg.at("gate").get<std::string>();
    return info;
}

} // anonymous namespace

// ---- AeroDataBoxClient ------------------------------------------------------

AeroDataBoxClient::AeroDataBoxClient(std::string apiKey) : apiKey_(std::move(apiKey)) {}

std::optional<FlightSchedule> AeroDataBoxClient::lookupFlight(const std::string& flightNumber) const {
    std::string url = "https://aerodatabox.p.rapidapi.com/flights/number/" + flightNumber +
                       "?withAircraftImage=false&withLocation=false&withFlightPlan=false";

    auto body = httpGet(url, apiKey_);
    if (!body) return std::nullopt;

    try {
        nlohmann::json parsed = nlohmann::json::parse(*body);
        if (!parsed.is_array() || parsed.empty()) return std::nullopt;
        // Daily long-hauls come back as several legs (e.g. yesterday's landed one
        // first, and sometimes a stale "Departed" duplicate of today's). Prefer the
        // most recently updated airborne leg; otherwise first match (MVP rule).
        // lastUpdatedUtc is "YYYY-MM-DD HH:MMZ", so string comparison orders it.
        const nlohmann::json* chosen = nullptr;
        for (const auto& f : parsed) {
            if (!isAirborne(f.value("status", std::string()))) continue;
            if (!chosen || f.value("lastUpdatedUtc", std::string()) >
                           chosen->value("lastUpdatedUtc", std::string())) {
                chosen = &f;
            }
        }
        const nlohmann::json& flight = chosen ? *chosen : parsed.at(0);

        models::FlightData data;
        data.flightNumber = flight.value("number", flightNumber);
        data.callsign = deriveCallsign(flight);
        // modeS is what OpenSky keys on; can be absent or JSON null for unassigned aircraft.
        if (flight.contains("aircraft") && flight.at("aircraft").contains("modeS")
            && flight.at("aircraft").at("modeS").is_string()) {
            data.icao24 = flight.at("aircraft").at("modeS").get<std::string>();
        }
        data.airline = flight.value("/airline/name"_json_pointer, std::string());
        data.aircraft = flight.value("/aircraft/model"_json_pointer, std::string("Unknown"));
        data.departure = mapAirport(flight.at("departure"));
        data.arrival = mapAirport(flight.at("arrival"));
        std::string rawStatus = flight.value("status", std::string("Unknown"));
        data.status = mapStatus(rawStatus);

        const auto& dep = flight.at("departure");
        const auto& arr = flight.at("arrival");
        auto depScheduled = parseUtc(legTime(dep, "scheduledTime", "utc"));
        auto arrScheduled = parseUtc(legTime(arr, "scheduledTime", "utc"));
        auto depRevised = parseUtc(legTime(dep, "revisedTime", "utc"));
        // predictedTime is AeroDataBox's live estimate, so it's the best source for ETA.
        auto arrBestEstimate = parseUtc(firstLegTime(arr, {"predictedTime", "revisedTime", "scheduledTime"}, "utc"));

        data.duration = (depScheduled && arrScheduled) ? formatDuration(*depScheduled, *arrScheduled) : "";
        data.delay = computeDelay(depScheduled, depRevised);
        if (data.delay && data.status == models::FlightStatus::Ontime) {
            data.status = models::FlightStatus::Delayed;
        }

        data.date = formatDisplayDate(firstLegTime(dep, {"scheduledTime", "revisedTime"}, "local"));
        data.progress = computeProgress(data.status, depScheduled, arrScheduled);
        data.telemetry = std::nullopt; // filled in by merge_service when airborne
        data.events = {};

        FlightSchedule schedule;
        schedule.flight = std::move(data);
        schedule.arrivalUtc = arrBestEstimate;
        schedule.airborne = isAirborne(rawStatus);
        return schedule;
    } catch (const nlohmann::json::exception& e) {
        std::cerr << "[AeroDataBoxClient] response shape unexpected: " << e.what() << std::endl;
        return std::nullopt; // malformed/unexpected shape — treat as not found, don't crash
    }
}

} // namespace services
