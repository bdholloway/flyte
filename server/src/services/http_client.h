#ifndef HTTP_CLIENT_H
#define HTTP_CLIENT_H

#include <optional>
#include <string>
#include <vector>

// Thin libcurl wrappers shared by the upstream API clients. Each call returns the
// response body on HTTP 200 and nullopt otherwise; failures are logged to stderr
// with `logTag` (e.g. "[OpenSkyClient] token request") so they show up in the
// container logs.
namespace services::http
{

std::optional<std::string> get(const std::string& url,
                               const std::vector<std::string>& headers,
                               const std::string& logTag);

// POST an application/x-www-form-urlencoded body.
std::optional<std::string> postForm(const std::string& url,
                                    const std::string& body,
                                    const std::string& logTag);

// Percent-encode a value for use in a URL or form body.
std::string urlEncode(const std::string& value);

} // end namespace services::http

#endif
