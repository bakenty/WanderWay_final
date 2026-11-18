/**
 * theme.js — light / dark mode.
 * Loaded in <head> so the saved theme is applied before the page paints (no flash).
 * The choice is stored in localStorage and therefore stays the same on every page.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'ww_theme';

    function readSaved() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function systemPrefersDark() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /** Apply a theme to <html> and sync the toggle switch (if present). */
    function applyTheme(theme, persist) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* storage blocked */ }
        }
        var toggle = document.getElementById('themeToggle');
        if (toggle) {
            var isDark = theme === 'dark';
            toggle.setAttribute('aria-checked', String(isDark));
            toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
            toggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
        }
    }

    var saved = readSaved();
    applyTheme(saved === 'dark' || saved === 'light' ? saved : (systemPrefersDark() ? 'dark' : 'light'), false);

    document.addEventListener('DOMContentLoaded', function () {
        var toggle = document.getElementById('themeToggle');
        applyTheme(document.documentElement.getAttribute('data-bs-theme'), false);
        if (!toggle) return;
        toggle.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(next, true);
        });
    });

    // Keep several open tabs in sync.
    window.addEventListener('storage', function (event) {
        if (event.key === STORAGE_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
            applyTheme(event.newValue, false);
        }
    });
})();
