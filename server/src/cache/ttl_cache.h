#ifndef TTL_CACHE_H
#define TTL_CACHE_H

#include <chrono>
#include <iterator>
#include <mutex>
#include <optional>
#include <unordered_map>

namespace cache
{

// Small thread-safe key/value cache where every entry expires `ttl` after it
// was stored. Expiry is lazy: a stale entry is dropped when it's next read, and
// put() purges all stale entries once the map grows past maxEntries so keys
// that are never read again can't accumulate forever. No sweep thread needed
// at this scale (cpp-httplib's thread pool is the only concurrency).
template <typename Key, typename Value>
class TtlCache
{

public:
    explicit TtlCache(std::chrono::steady_clock::duration ttl, size_t maxEntries = 1024)
        : ttl_(ttl), maxEntries_(maxEntries)
    {
    }

    std::optional<Value> get(const Key& key)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = entries_.find(key);
        if (it == entries_.end()) return std::nullopt;
        if (Clock::now() >= it->second.expiresAt)
        {
            entries_.erase(it);
            return std::nullopt;
        }
        return it->second.value;
    }

    void put(const Key& key, Value value)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (entries_.size() >= maxEntries_) purgeExpired();
        entries_.insert_or_assign(key, Entry{std::move(value), Clock::now() + ttl_});
    }

private:
    using Clock = std::chrono::steady_clock; // immune to wall-clock jumps

    struct Entry
    {
        Value value;
        Clock::time_point expiresAt;
    };

    // Caller must hold mutex_.
    void purgeExpired()
    {
        auto now = Clock::now();
        for (auto it = entries_.begin(); it != entries_.end();)
        {
            it = (now >= it->second.expiresAt) ? entries_.erase(it) : std::next(it);
        }
    }

    const Clock::duration ttl_;
    const size_t maxEntries_;
    std::mutex mutex_;
    std::unordered_map<Key, Entry> entries_;
};


} // end namespace cache

#endif
