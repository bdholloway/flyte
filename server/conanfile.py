from conan import ConanFile
from conan.tools.cmake import CMakeToolchain, CMakeDeps, cmake_layout

class FlyteServerConan(ConanFile):
    settings = "os", "compiler", "build_type", "arch"
    generators = "CMakeDeps", "CMakeToolchain"
    package_type = "application"

    def requirements(self):
        self.requires("cpp-httplib/0.47.0")
        self.requires("nlohmann_json/3.12.0")

    def layout(self):
        cmake_layout(self)

    def configure(self):
        self.options["cpp-httplib"].with_openssl = False