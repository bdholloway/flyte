#ifndef FLIGHT_DATA_JSON_H
#define FLIGHT_DATA_JSON_H

#include "flight_data.h"
#include <nlohmann/json.hpp>

namespace models
{

NLOHMANN_JSON_SERIALIZE_ENUM(FlightStatus, {
    {FlightStatus::Scheduled, "scheduled"},
    {FlightStatus::Ontime, "on-time"},
    {FlightStatus::Delayed, "delayed"},
    {FlightStatus::Boarding, "boarding"},
    {FlightStatus::Enroute, "en-route"},
    {FlightStatus::Landed, "landed"},
    {FlightStatus::Cancelled, "cancelled"},
})

inline void to_json(nlohmann::json& j, const AirportInfo& a)
{
    j = nlohmann::json{
        {"code", a.code},
        {"city", a.city},
        {"time", a.time},
    };
    if (a.terminal)
    {
        j["terminal"] = *a.terminal;
    }
    if (a.gate)
    {
        j["gate"] = *a.gate;
    }
}

inline void from_json(const nlohmann::json& j, AirportInfo& a)
{
    j.at("code").get_to(a.code);
    j.at("city").get_to(a.city);
    j.at("time").get_to(a.time);
    a.terminal = j.contains("terminal") ? std::optional<std::string>(j.at("terminal").get<std::string>()) : std::nullopt;
    a.gate = j.contains("gate") ? std::optional<std::string>(j.at("gate").get<std::string>()) : std::nullopt;
}

inline void to_json(nlohmann::json& j, const Telemetry& t)
{
    j = nlohmann::json{
        {"altitude", t.altitude},
        {"speed", t.speed},
        {"heading", t.heading},
        {"etaMinutes", t.etaMinutes},
        {"lastUpdated", t.lastUpdated},
    };
}

inline void from_json(const nlohmann::json& j, Telemetry& t)
{
    j.at("altitude").get_to(t.altitude);
    j.at("speed").get_to(t.speed);
    j.at("heading").get_to(t.heading);
    j.at("etaMinutes").get_to(t.etaMinutes);
    j.at("lastUpdated").get_to(t.lastUpdated);
}

inline void to_json(nlohmann::json& j, const FlightEvent& e)
{
    j = nlohmann::json{
        {"time", e.time},
        {"label", e.label},
    };
}

inline void from_json(const nlohmann::json& j, FlightEvent& e)
{
    j.at("time").get_to(e.time);
    j.at("label").get_to(e.label);
}

inline void to_json(nlohmann::json& j, const FlightData& d)
{
    j = nlohmann::json{
        {"flightNumber", d.flightNumber},
        {"callsign", d.callsign},
        {"airline", d.airline},
        {"status", d.status},
        {"departure", d.departure},
        {"arrival", d.arrival},
        {"duration", d.duration},
        {"aircraft", d.aircraft},
        {"progress", d.progress},
        {"date", d.date},
        {"events", d.events},
    };
    if(d.icao24) j["icao24"] = *d.icao24;
    if(d.delay) j["delay"] = *d.delay;
    j["telemetry"] = d.telemetry.has_value() 
        ? nlohmann::json(*d.telemetry)
        : nlohmann::json(nullptr);    
}

inline void from_json(const nlohmann::json& j, FlightData& d)
{
    j.at("flightNumber").get_to(d.flightNumber);
    j.at("callsign").get_to(d.callsign);
    j.at("airline").get_to(d.airline);
    j.at("status").get_to(d.status);
    j.at("departure").get_to(d.departure);
    j.at("arrival").get_to(d.arrival);
    j.at("duration").get_to(d.duration);
    j.at("aircraft").get_to(d.aircraft);
    j.at("progress").get_to(d.progress);
    j.at("date").get_to(d.date);
    j.at("events").get_to(d.events);

    d.icao24 = j.contains("icao24") ? std::optional<std::string>(j.at("icao24").get<std::string>()) : std::nullopt;
    d.delay = j.contains("delay") ? std::optional<std::string>(j.at("delay").get<std::string>()) : std::nullopt;

    const auto& telemetryJson = j.at("telemetry");
    d.telemetry = telemetryJson.is_null() ? std::nullopt : std::optional<Telemetry>(telemetryJson.get<Telemetry>());
}

inline void to_json(nlohmann::json& j, const LiveUpdate& u)
{
    j = nlohmann::json{
        {"status", u.status},
        {"progress", u.progress},
    };
    j["telemetry"] = u.telemetry.has_value()
        ? nlohmann::json(*u.telemetry)
        : nlohmann::json(nullptr);
}

inline void from_json(const nlohmann::json& j, LiveUpdate& u)
{
    j.at("status").get_to(u.status);
    j.at("progress").get_to(u.progress);

    const auto& telemetryJson = j.at("telemetry");
    u.telemetry = telemetryJson.is_null() ? std::nullopt : std::optional<Telemetry>(telemetryJson.get<Telemetry>());
}

} // end namespace models

#endif