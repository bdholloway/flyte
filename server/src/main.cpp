#include "config/env_config.h"
#include "models/flight_data_json.h"
#include "services/aerodatabox_client.h"
#include "services/merge_service.h"
#include "services/opensky_client.h"

#include <httplib.h>
#include <nlohmann/json.hpp>
#include <cstdlib>
#include <string>

int main()
{
    config::EnvConfig cfg = config::loadEnvConfig();
    services::AeroDataBoxClient aeroDataBox(cfg.aerodataboxKey);
    services::OpenSkyClient openSky(cfg.openskyClientId, cfg.openskyClientSecret);
    services::MergeService mergeService(aeroDataBox, openSky);

    httplib::Server svr;

    svr.Get("/flights/:flightNumber", [&mergeService](const httplib::Request& req, httplib::Response& res)
    {
        std::string flightNumber = req.path_params.at("flightNumber");
        std::optional<models::FlightData> data = mergeService.lookupFlight(flightNumber);

        if (!data)
        {
            res.status = 404;
            res.set_content(nlohmann::json{{"error", "Flight not found"}}.dump(), "application/json");
            return;
        }

        nlohmann::json j = *data;
        res.set_content(j.dump(), "application/json");
    });

    // Polled every 5-10s by the live tracker. No ADS-B coverage is a 200 with
    // telemetry: null (the UI's existing path), never an error.
    svr.Get("/flights/:flightNumber/live", [&mergeService](const httplib::Request& req, httplib::Response& res)
    {
        std::string flightNumber = req.path_params.at("flightNumber");
        std::optional<models::LiveUpdate> update = mergeService.lookupLive(flightNumber);

        if (!update)
        {
            res.status = 404;
            res.set_content(nlohmann::json{{"error", "Flight not found"}}.dump(), "application/json");
            return;
        }

        nlohmann::json j = *update;
        res.set_content(j.dump(), "application/json");
    });

    svr.listen("0.0.0.0", cfg.port);
}
