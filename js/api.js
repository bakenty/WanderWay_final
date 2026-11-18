/**
 * api.js — REST Countries public API (https://restcountries.com), no key needed.
 * Used on the Destinations page to show live facts about a country.
 */
window.WW = window.WW || {};

WW.api = (function () {
    var BASE = 'https://restcountries.com/v3.1/name/';
    var FIELDS = 'name,capital,region,subregion,population,currencies,languages,flags,cca2';
    var TIMEOUT_MS = 8000;
    var cache = {};   // avoids repeated requests for the same country during a visit

    /** Turns the raw API object into a small, predictable shape. */
    function normalize(c) {
        return {
            name: c.name.common,
            official: c.name.official,
            capital: (c.capital || []).join(', ') || '—',
            region: [c.subregion, c.region].filter(Boolean).join(' · ') || '—',
            population: c.population || 0,
            currencies: Object.keys(c.currencies || {}).map(function (code) {
                return c.currencies[code].name + ' (' + code + ')';
            }),
            languages: Object.keys(c.languages || {}).map(function (k) { return c.languages[k]; }),
            flag: (c.flags && (c.flags.svg || c.flags.png)) || '',
            flagAlt: (c.flags && c.flags.alt) || ('Flag of ' + c.name.common),
            code: c.cca2 || ''
        };
    }

    /** Fetches one country by name. Rejects with an Error whose .kind is not_found | timeout | network | server. */
    function getCountry(name) {
        var key = name.trim().toLowerCase();
        if (cache[key]) return Promise.resolve(cache[key]);

        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

        return fetch(BASE + encodeURIComponent(name.trim()) + '?fields=' + FIELDS, { signal: controller.signal })
            .then(function (response) {
                if (response.status === 404) throw Object.assign(new Error('not found'), { kind: 'not_found' });
                if (!response.ok) throw Object.assign(new Error('server'), { kind: 'server' });
                return response.json();
            })
            .then(function (list) {
                if (!Array.isArray(list) || !list.length) throw Object.assign(new Error('not found'), { kind: 'not_found' });
                // Prefer an exact name match, otherwise the most populous result.
                var exact = list.filter(function (c) { return c.name.common.toLowerCase() === key; })[0];
                var best = exact || list.sort(function (a, b) { return (b.population || 0) - (a.population || 0); })[0];
                return (cache[key] = normalize(best));
            })
            .catch(function (err) {
                if (err.kind) throw err;
                throw Object.assign(err, { kind: err.name === 'AbortError' ? 'timeout' : 'network' });
            })
            .finally(function () { clearTimeout(timer); });
    }

    /** Friendly message for each failure type. */
    function errorMessage(err) {
        switch (err && err.kind) {
            case 'not_found': return 'We could not find that country. Check the spelling and try again.';
            case 'timeout': return 'The request took too long. Please try again in a moment.';
            case 'network': return 'Could not reach the country service. Check your internet connection and try again.';
            default: return 'The country service is having problems. Please try again later.';
        }
    }

    return { getCountry: getCountry, errorMessage: errorMessage };
})();
