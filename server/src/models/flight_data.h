#ifndef FLIGHT_DATA_H
#define FLIGHT_DATA_H

#include <string>
#include <vector>
#include <optional>

namespace models
{

enum class FlightStatus 
{ 
    Scheduled,
    Ontime,
    Delayed,
    Boarding,
    Enroute,
    Landed,
    Cancelled    
};

struct AirportInfo 
{
    std::string code;
    std::string city;
    std::string time;
    std::optional<std::string> terminal;
    std::optional<std::string> gate;
};

struct Telemetry 
{
    double altitude;
    double speed;
    double heading;
    int etaMinutes;
    std::string lastUpdated;
};

struct FlightEvent
{
    std::string time;
    std::string label;
};

struct FlightData
{
    std::string flightNumber;
    std::string callsign;
    std::optional<std::string> icao24;
    std::string airline;
    FlightStatus status;
    AirportInfo departure;
    AirportInfo arrival;
    std::string duration;
    std::string aircraft;
    int progress;
    std::optional<std::string> delay;
    std::string date;
    std::optional<Telemetry> telemetry;
    std::vector<FlightEvent> events;
};


} //end namespace models

#endif