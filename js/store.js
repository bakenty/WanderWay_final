/**
 * store.js — safe localStorage wrapper and per-user saved data
 * (favourite destinations and recent searches).
 */
window.WW = window.WW || {};

WW.store = {
    /** Read and JSON-parse a key; returns `fallback` if missing, broken or blocked. */
    read: function (key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
    },
    write: function (key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove: function (key) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
};

/**
 * Saved data is kept per account (key "ww_data_<email>").
 * Visitors who are not logged in share a "guest" bucket, which is merged into
 * the account the first time they log in.
 */
WW.data = (function () {
    var MAX_SEARCHES = 8;

    function bucketKey(owner) {
        return 'ww_data_' + (owner || WW.store.read('ww_session', null) || 'guest');
    }
    function load(owner) {
        var d = WW.store.read(bucketKey(owner), {}) || {};
        return {
            favorites: Array.isArray(d.favorites) ? d.favorites : [],
            searches: Array.isArray(d.searches) ? d.searches : []
        };
    }
    function save(d, owner) { WW.store.write(bucketKey(owner), d); }

    return {
        getFavorites: function () { return load().favorites; },
        isFavorite: function (name) {
            return load().favorites.some(function (f) { return f.toLowerCase() === name.toLowerCase(); });
        },
        /** Adds or removes a favourite; returns true if it is now saved. */
        toggleFavorite: function (name) {
            var d = load();
            var index = d.favorites.findIndex(function (f) { return f.toLowerCase() === name.toLowerCase(); });
            if (index >= 0) d.favorites.splice(index, 1); else d.favorites.push(name);
            save(d);
            return index < 0;
        },
        getSearches: function () { return load().searches; },
        /** Remembers a search term (newest first, no duplicates, capped). */
        addSearch: function (term) {
            term = String(term || '').trim();
            if (term.length < 2) return;
            var d = load();
            d.searches = [term].concat(d.searches.filter(function (s) { return s.toLowerCase() !== term.toLowerCase(); }))
                .slice(0, MAX_SEARCHES);
            save(d);
        },
        clearSearches: function () { var d = load(); d.searches = []; save(d); },
        clearFavorites: function () { var d = load(); d.favorites = []; save(d); },
        deleteOwner: function (owner) { WW.store.remove(bucketKey(owner)); },
        /** Moves guest favourites/searches into an account after login. */
        mergeGuestInto: function (owner) {
            var guest = load('guest');
            if (!guest.favorites.length && !guest.searches.length) return;
            var d = load(owner);
            guest.favorites.forEach(function (f) {
                if (!d.favorites.some(function (x) { return x.toLowerCase() === f.toLowerCase(); })) d.favorites.push(f);
            });
            guest.searches.forEach(function (s) {
                if (!d.searches.some(function (x) { return x.toLowerCase() === s.toLowerCase(); })) d.searches.push(s);
            });
            d.searches = d.searches.slice(0, MAX_SEARCHES);
            save(d, owner);
            WW.store.remove(bucketKey('guest'));
        }
    };
})();
