#include "models/flight_data_json.h"

#include <httplib.h>
#include <nlohmann/json.hpp>
#include <cstdlib>
#include <string>

int main()
{
    httplib::Server svr;

    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res) 
    {
        res.set_header("Access-Control-Allow-Origin", "http://localhost:5173");
        return httplib::Server::HandlerResponse::Unhandled;
    });

    svr.Get("/flights/:flightNumber", [](const httplib::Request& req, httplib::Response& res)
    {
        models::FlightData data = {
            "AA 2847",                                     // flightNumber
            "AAL2847",                                     // callsign (ICAO — AA's ICAO prefix is AAL)
            std::nullopt,                                  // icao24 (not resolved yet)
            "American Airlines",                           // airline
            models::FlightStatus::Ontime,                  // status
            { "JFK", "New York", "14:30", "4", "B22" },    // departure
            { "LAX", "Los Angeles", "17:45", "3", "A8" },  // arrival
            "5h 15m",                                      // duration
            "Boeing 737-800",                              // aircraft
            62,                                             // progress
            std::nullopt,                                  // delay
            "Wed, 20 Aug",                                  // date
            models::Telemetry{ 38000, 547, 265, 114, "2026-08-29T16:42:00Z" }, // telemetry
            {
                { "16:42", "Cruising at FL380" },
                { "15:20", "Reached cruising altitude" },
                { "14:35", "Departed JFK" },
                { "14:20", "Pushback complete" },
                { "14:05", "Boarding complete" },
            }
        };
        nlohmann::json j = data;
        res.set_content(j.dump(), "application/json");
    });

    const char* portEnv = std::getenv("PORT");
    int port = portEnv ? std::stoi(portEnv) : 8080;
    svr.listen("0.0.0.0", port);
}
