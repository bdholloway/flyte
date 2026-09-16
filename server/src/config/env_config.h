#pragma once
#include <string>

namespace config {

struct EnvConfig {
    int port;
    std::string aerodataboxKey;
};

EnvConfig loadEnvConfig();

} // namespace config
