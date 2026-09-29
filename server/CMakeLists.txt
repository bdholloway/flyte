cmake_minimum_required(VERSION 3.15)
project(flyte_server CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(httplib REQUIRED)
find_package(nlohmann_json REQUIRED)
find_package(CURL REQUIRED CONFIG)

add_executable(flyte_server src/main.cpp src/config/env_config.cpp src/services/aerodatabox_client.cpp src/services/opensky_client.cpp src/services/merge_service.cpp src/services/http_client.cpp)
target_include_directories(flyte_server PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(flyte_server PRIVATE httplib::httplib nlohmann_json::nlohmann_json CURL::libcurl)