#include "http_client.h"

#include <curl/curl.h>

#include <iostream>

namespace services::http
{

namespace {

constexpr long kTimeoutSeconds = 10;

size_t writeCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    static_cast<std::string*>(userdata)->append(ptr, size * nmemb);
    return size * nmemb;
}

// Runs a request on an already-configured handle, then cleans up both the
// handle and the header list.
std::optional<std::string> perform(CURL* curl, curl_slist* headers, const std::string& logTag) {
    std::string body;
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writeCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &body);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, kTimeoutSeconds);

    CURLcode res = curl_easy_perform(curl);
    long httpCode = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK || httpCode != 200) {
        std::cerr << logTag << " failed: curl=" << curl_easy_strerror(res)
                  << " httpCode=" << httpCode << " body=" << body << std::endl;
        return std::nullopt;
    }
    return body;
}

} // anonymous namespace

std::optional<std::string> get(const std::string& url,
                               const std::vector<std::string>& headers,
                               const std::string& logTag) {
    CURL* curl = curl_easy_init();
    if (!curl) return std::nullopt;

    curl_slist* list = nullptr;
    for (const auto& h : headers) list = curl_slist_append(list, h.c_str());

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    return perform(curl, list, logTag);
}

std::optional<std::string> postForm(const std::string& url,
                                    const std::string& body,
                                    const std::string& logTag) {
    CURL* curl = curl_easy_init();
    if (!curl) return std::nullopt;

    curl_slist* list = curl_slist_append(nullptr, "Content-Type: application/x-www-form-urlencoded");

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    // COPYPOSTFIELDS: libcurl keeps its own copy, so `body` needn't outlive the call.
    curl_easy_setopt(curl, CURLOPT_COPYPOSTFIELDS, body.c_str());
    return perform(curl, list, logTag);
}

std::string urlEncode(const std::string& value) {
    CURL* curl = curl_easy_init();
    if (!curl) return value;
    char* escaped = curl_easy_escape(curl, value.c_str(), static_cast<int>(value.length()));
    std::string result = escaped ? escaped : value;
    if (escaped) curl_free(escaped);
    curl_easy_cleanup(curl);
    return result;
}

} // end namespace services::http
