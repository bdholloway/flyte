FROM debian:bookworm AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential cmake python3-pip \
    && pip install --break-system-packages conan \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY conanfile.py .
RUN conan profile detect --force \
    && conan install . --build=missing -s build_type=Release

COPY CMakeLists.txt .
COPY src ./src
RUN cmake -S . -B build/Release \
      -DCMAKE_TOOLCHAIN_FILE=build/Release/generators/conan_toolchain.cmake \
      -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build/Release

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build/Release/flyte_server /usr/local/bin/flyte_server
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/flyte_server"]
