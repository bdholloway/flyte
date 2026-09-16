#include "env_config.h"
#include <cstdlib>
#include <stdexcept>

namespace config {
namespace {

std::string getEnvOr(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    return (value && *value) ? value : fallback;
}

std::string requireEnv(const char* name) {
    const char* value = std::getenv(name);
    if (!value || *value == '\0') {
        throw std::runtime_error(std::string("Missing required environment variable: ") + name);
    }
    return value;
}

} // namespace

EnvConfig loadEnvConfig() {
    EnvConfig cfg;
    cfg.port = std::stoi(getEnvOr("PORT", "8080"));
    cfg.aerodataboxKey = requireEnv("AERODATABOX_KEY");
    return cfg;
}

} // namespace config
