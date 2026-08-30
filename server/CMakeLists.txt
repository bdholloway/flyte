cmake_minimum_required(VERSION 3.15)
project(flyte_server CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(httplib REQUIRED)
find_package(nlohmann_json REQUIRED)

add_executable(flyte_server src/main.cpp)
target_link_libraries(flyte_server PRIVATE httplib::httplib nlohmann_json::nlohmann_json)