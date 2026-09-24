#pragma once
#include <string>

namespace config {

struct EnvConfig {
    int port;
    std::string aerodataboxKey;
    std::string openskyClientId;
    std::string openskyClientSecret;
};

EnvConfig loadEnvConfig();

} // namespace config
