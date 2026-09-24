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

    svr.set_pre_routing_handler([](const httplib::Request& req, httplib::Response& res)
    {
        res.set_header("Access-Control-Allow-Origin", "http://localhost:5173");
        return httplib::Server::HandlerResponse::Unhandled;
    });

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

    svr.listen("0.0.0.0", cfg.port);
}
