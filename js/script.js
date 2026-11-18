/**
 * script.js — WanderWay user interface and page logic.
 *
 * Depends on (loaded before this file): jQuery, WW.store, WW.data, WW.validator, WW.auth, WW.api.
 *
 * Sections
 *   1. Helpers (escaping, toasts, button spinner)
 *   2. Site-wide UI (navbar, scroll progress, lazy images, keyboard navigation)
 *   3. Home page (counters, FAQ, idea finder, subscribe popup)
 *   4. Tips page (copy to clipboard)
 *   5. Destinations page (search, filters, favourites, REST Countries API)
 *   6. Forms and accounts (contact, sign up, log in, profile)
 */
(function ($) {
    'use strict';

    // Pages marked data-auth="required" redirect guests immediately.
    WW.auth.guard();

    /* ======================================================
       1. HELPERS
       ====================================================== */

    /** Escapes text before it is placed inside an HTML string. */
    function esc(value) {
        return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    /** Short message in the corner of the screen. */
    function showToast(message) {
        const $toast = $('<div>', { class: 'travel-toast', text: message });
        $('#toastContainer').append($toast);
        setTimeout(() => {
            $toast.addClass('toast-hide');
            setTimeout(() => $toast.remove(), 350);
        }, 2600);
    }

    /**
     * Disables a submit button and shows a spinner while `task` runs
     * (at least 600 ms so the loading state is noticeable).
     */
    function withSpinner($button, task) {
        const original = $button.html();
        $button.prop('disabled', true).html('<span class="jquery-spinner" aria-hidden="true"></span> Please wait...');
        const minimumDelay = new Promise(resolve => setTimeout(resolve, 600));
        return Promise.all([Promise.resolve().then(task), minimumDelay])
            .then(results => results[0])
            .finally(() => $button.prop('disabled', false).html(original));
    }

    /* ======================================================
       2. SITE-WIDE UI
       ====================================================== */

    /** Scroll progress bar at the top of the page. */
    function initScrollProgress() {
        const update = () => {
            const scrollable = $(document).height() - $(window).height();
            $('#scrollProgressFill').css('width', (scrollable > 0 ? ($(window).scrollTop() / scrollable) * 100 : 0) + '%');
        };
        $(window).on('scroll resize', update);
        update();
    }

    /** Loads images (data-src) just before they enter the viewport. */
    function initLazyImages() {
        const images = document.querySelectorAll('img[data-src]');
        const load = img => { img.src = img.dataset.src; img.removeAttribute('data-src'); };
        if (!('IntersectionObserver' in window)) { images.forEach(load); return; }
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { load(entry.target); observer.unobserve(entry.target); }
            });
        }, { rootMargin: '200px 0px' });
        images.forEach(img => observer.observe(img));
    }

    /** Arrow keys move focus through the main menu. */
    function initMenuKeyboard() {
        const links = Array.from(document.querySelectorAll('.navbar-nav .nav-link'));
        links.forEach((link, index) => link.addEventListener('keydown', event => {
            let next = index;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % links.length;
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + links.length) % links.length;
            else return;
            event.preventDefault();
            links[next].focus();
        }));
    }

    /* ======================================================
       3. HOME PAGE
       ====================================================== */

    /** Statistics count up the first time they scroll into view. */
    function initCounters() {
        const $counters = $('.stat-number');
        if (!$counters.length) return;
        let started = false;
        const check = () => {
            if (started || $counters.first().offset().top > $(window).scrollTop() + $(window).height()) return;
            started = true;
            $counters.each(function () {
                const $counter = $(this);
                const target = Number($counter.attr('data-target'));
                const suffix = $counter.attr('data-suffix') || '';
                $({ count: 0 }).animate({ count: target }, {
                    duration: 1600,
                    step() { $counter.text(Math.floor(this.count).toLocaleString()); },
                    complete() { $counter.text(target.toLocaleString() + suffix); }
                });
            });
        };
        $(window).on('scroll resize', check);
        check();
    }

    /** FAQ accordion with live search that highlights matches. */
    function initFaq() {
        const $items = $('.faq-item');
        if (!$items.length) return;

        $items.find('.faq-question').on('click', function () {
            const $item = $(this).closest('.faq-item');
            const open = !$item.hasClass('open');
            $item.toggleClass('open', open);
            $(this).attr('aria-expanded', String(open));
        });

        // Remember the original plain text so highlighting can always be reset.
        const originals = $items.map(function () {
            return { question: $(this).find('.faq-question').text(), answer: $(this).find('.faq-answer p').text() };
        }).get();

        const highlight = (el, text, query) => {
            el.textContent = '';
            if (!query) { el.textContent = text; return; }
            text.split(new RegExp('(' + escapeRegExp(query) + ')', 'gi')).forEach((part, i) => {
                if (i % 2 === 1) { const mark = document.createElement('mark'); mark.textContent = part; el.appendChild(mark); }
                else el.appendChild(document.createTextNode(part));
            });
        };

        $('#faqSearch').on('input', function () {
            const query = $(this).val().trim();
            let visible = 0;
            $items.each(function (i) {
                const text = originals[i];
                const matches = !query || (text.question + ' ' + text.answer).toLowerCase().includes(query.toLowerCase());
                $(this).toggle(matches);
                highlight($(this).find('.faq-question')[0], text.question, matches ? query : '');
                highlight($(this).find('.faq-answer p')[0], text.answer, matches ? query : '');
                if (query && matches) { $(this).addClass('open').find('.faq-question').attr('aria-expanded', 'true'); }
                if (matches) visible++;
            });
            $('#faqSearchMessage').text(query ? (visible ? visible + ' matching question(s).' : 'No questions match your search.') : '');
        });
    }

    /** "Quick Destination Finder": suggests an idea for the chosen travel style. */
    function initIdeaFinder() {
        const $card = $('#destinationSuggestion');
        if (!$card.length) return;
        const ideas = [
            { category: 'nature', title: 'Nature escape', text: "Explore Kazakhstan's mountains and wide-open landscapes." },
            { category: 'culture', title: 'Culture trip', text: 'Discover traditional temples, museums, local food and history in Japan.' },
            { category: 'city', title: 'City adventure', text: "Walk through Italy's lively squares, historic streets and beautiful cities." },
            { category: 'culture', title: 'Ancient wonders', text: 'See the pyramids and the Sphinx in Egypt at golden sunset.' },
            { category: 'nature', title: 'Alpine views', text: 'Walk through Swiss mountain villages beside crystal-blue lakes.' },
            { category: 'nature', title: 'Island sunset', text: 'Relax in a white Greek island village above the sea.' },
            { category: 'nature', title: 'Coastal reset', text: 'Spend a relaxing day by the sea and enjoy the natural scenery.' }
        ];
        const show = idea => {
            $('#suggestionTitle').text(idea.title);
            $('#suggestionText').text(idea.text);
            $card.removeClass('pulse'); void $card[0].offsetWidth; $card.addClass('pulse');
        };
        $('.travel-filter').on('click', function () {
            $('.travel-filter').removeClass('btn-primary').addClass('btn-outline-primary');
            $(this).addClass('btn-primary').removeClass('btn-outline-primary');
            const matches = ideas.filter(idea => idea.category === this.dataset.category);
            show(matches[Math.floor(Math.random() * matches.length)]);
            $('#interactionMessage').text('Showing a ' + this.dataset.category + ' idea.');
        });
        $('#surpriseMeBtn').on('click', () => {
            show(ideas[Math.floor(Math.random() * ideas.length)]);
            $('#interactionMessage').text('Surprise! A new travel idea has been selected.');
        });
    }

    /** Newsletter popup (validated, stored in localStorage). */
    function initSubscribePopup() {
        const popup = document.getElementById('subscriptionModal');
        if (!popup) return;
        const close = () => { popup.classList.remove('show'); popup.setAttribute('aria-hidden', 'true'); };
        $('#openPopupBtn, .js-open-subscribe').on('click', () => {
            popup.classList.add('show');
            popup.setAttribute('aria-hidden', 'false');
            document.getElementById('subscribeName').focus();
        });
        $('#closePopupBtn').on('click', close);
        popup.addEventListener('click', event => { if (event.target === popup) close(); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

        WW.validator.attach(document.getElementById('subscriptionForm'), (values, form) => {
            const $button = $(form).find('button[type="submit"]');
            withSpinner($button, () => {
                const list = WW.store.read('ww_subscribers', []);
                if (!list.some(s => s.email.toLowerCase() === values.subscribeEmail.toLowerCase())) {
                    list.push({ name: values.subscribeName, email: values.subscribeEmail, date: new Date().toISOString() });
                    WW.store.write('ww_subscribers', list);
                }
            }).then(() => {
                form.reset();
                WW.validator.setStatus(form, 'Thank you! You are subscribed to WanderWay updates.', 'success');
                showToast('Subscribed successfully');
            });
        });
    }

    /* ======================================================
       4. TIPS PAGE
       ====================================================== */

    function initCopyTips() {
        function fallbackCopy(text) {
            const $temp = $('<textarea>').val(text).css({ position: 'fixed', left: '-9999px' }).appendTo('body');
            $temp[0].select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            $temp.remove();
            return ok;
        }
        $('.copy-tips').on('click', function () {
            const $button = $(this);
            const text = $button.closest('.card-body, #before-leave').find('ul, ol').text().replace(/\s+/g, ' ').trim();
            const done = ok => {
                if (!ok) { showToast('Copy is not available in this browser.'); return; }
                const old = $button.text();
                $button.text('✓ Copied!');
                showToast('Copied to clipboard');
                setTimeout(() => $button.text(old), 1800);
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => done(true)).catch(() => done(fallbackCopy(text)));
            } else done(fallbackCopy(text));
        });
    }

    /* ======================================================
       5. DESTINATIONS PAGE
       ====================================================== */

    /** HTML for a country facts block returned by the API. */
    function countryMarkup(country) {
        const row = (label, value) => '<dt>' + label + '</dt><dd>' + esc(value) + '</dd>';
        return '<div class="country-facts__head">' +
            '<img class="country-flag" src="' + esc(country.flag) + '" alt="' + esc(country.flagAlt) + '" width="56" height="38">' +
            '<div><strong>' + esc(country.name) + '</strong><div class="small text-muted">' + esc(country.official) + '</div></div></div>' +
            '<dl class="country-facts__list">' +
            row('Capital', country.capital) + row('Region', country.region) +
            row('Population', country.population.toLocaleString()) +
            row('Currency', country.currencies.join(', ') || '—') +
            row('Languages', country.languages.join(', ') || '—') + '</dl>';
    }

    const loadingMarkup = '<div class="api-loading" role="status"><span class="jquery-spinner jquery-spinner--dark" aria-hidden="true"></span> Loading country data...</div>';

    /** Marks every favourite button (card hearts and explorer button) with the current saved state. */
    function syncFavoriteButtons() {
        $('.js-fav').each(function () {
            const saved = WW.data.isFavorite(this.dataset.country);
            $(this).toggleClass('is-active', saved).attr('aria-pressed', String(saved));
            $(this).find('.fav-icon').text(saved ? '♥' : '♡');
            $(this).find('.fav-label').text(saved ? 'Saved' : 'Save to favourites');
        });
    }

    function initDestinations() {
        const $input = $('#destinationSearch');
        if (!$input.length) return;

        const FILTER_KEY = 'ww_dest_filters';
        const params = new URLSearchParams(window.location.search);
        const stored = WW.store.read(FILTER_KEY, {}) || {};
        const state = { query: params.get('q') || stored.query || '', category: stored.category || 'all' };

        const $cards = $('.destination-item');
        const names = $cards.map(function () { return $(this).find('h2').first().text().trim(); }).get();
        const $suggestions = $('#searchSuggestions');
        let saveTimer = null;

        /* --- filtering --- */
        function applyFilters() {
            const query = state.query.toLowerCase();
            let visible = 0;
            $cards.each(function () {
                const $card = $(this);
                const text = $card.find('.card-title, .card-text, li').text().toLowerCase();
                const match = (!query || text.includes(query)) && (state.category === 'all' || $card.data('category') === state.category);
                $card.closest('[class*="col-"]').toggle(match);
                if (match) visible++;
            });
            $('#noResults').prop('hidden', visible !== 0);
            $('#searchResultCount').text(
                visible === 0 ? 'No destinations found.' :
                (query || state.category !== 'all') ? visible + ' destination(s) found.' : 'Showing all destinations.');
            $('.filter-chip').each(function () {
                const active = this.dataset.category === state.category;
                $(this).toggleClass('active', active).attr('aria-pressed', String(active));
            });
            WW.store.write(FILTER_KEY, { query: state.query, category: state.category });
        }

        /* --- recent searches (saved in localStorage) --- */
        function renderRecent() {
            const searches = WW.data.getSearches();
            const $box = $('#recentSearches').empty();
            if (!searches.length) { $box.prop('hidden', true); return; }
            $box.prop('hidden', false).append('<span class="small text-muted me-1">Recent:</span>');
            searches.forEach(term => $('<button>', { type: 'button', class: 'recent-chip', text: term, 'data-term': term }).appendTo($box));
            $('<button>', { type: 'button', class: 'recent-clear', id: 'clearRecent', text: 'Clear' }).appendTo($box);
        }
        function rememberSearch() {
            if (state.query.trim().length >= 2) { WW.data.addSearch(state.query); renderRecent(); }
        }

        $input.val(state.query);
        applyFilters();
        renderRecent();

        $input.on('input', function () {
            state.query = $(this).val().trim();
            applyFilters();
            clearTimeout(saveTimer);
            saveTimer = setTimeout(rememberSearch, 900);

            $suggestions.empty();
            if (!state.query) return;
            const matches = names.filter(n => n.toLowerCase().includes(state.query.toLowerCase()));
            matches.forEach(n => $('<button>', { type: 'button', class: 'suggestion-option', text: n, role: 'option' }).appendTo($suggestions));
            if (!matches.length) $('<div>', { class: 'suggestion-empty', text: 'No suggestions found' }).appendTo($suggestions);
        });
        $input.on('keydown', e => { if (e.key === 'Enter') { clearTimeout(saveTimer); rememberSearch(); $suggestions.empty(); } });
        $suggestions.on('click', '.suggestion-option', function () {
            state.query = $(this).text();
            $input.val(state.query);
            applyFilters();
            rememberSearch();
            $suggestions.empty();
        });
        $(document).on('click', e => { if (!$(e.target).closest('.destination-search').length) $suggestions.empty(); });

        $('.filter-chip').on('click', function () { state.category = this.dataset.category; applyFilters(); });
        $('#recentSearches').on('click', '.recent-chip', function () {
            state.query = this.dataset.term; $input.val(state.query); applyFilters();
        });
        $('#recentSearches').on('click', '#clearRecent', () => { WW.data.clearSearches(); renderRecent(); showToast('Recent searches cleared'); });
        $('#resetFilters').on('click', () => { state.query = ''; state.category = 'all'; $input.val(''); applyFilters(); });

        /* --- favourites --- */
        syncFavoriteButtons();
        $(document).on('click', '.js-fav', function () {
            const name = this.dataset.country;
            const added = WW.data.toggleFavorite(name);
            syncFavoriteButtons();
            showToast(added ? name + ' saved to favourites' : name + ' removed from favourites');
        });

        /* --- country facts inside each card (REST Countries API) --- */
        $('.js-country-facts').on('click', function () {
            const $button = $(this);
            const $panel = $button.closest('.card-body').find('.country-facts');
            if ($panel.data('loaded')) {
                const hide = !$panel.prop('hidden');
                $panel.prop('hidden', hide);
                $button.attr('aria-expanded', String(!hide));
                return;
            }
            $panel.prop('hidden', false).html(loadingMarkup);
            $button.attr('aria-expanded', 'true').prop('disabled', true);
            WW.api.getCountry(this.dataset.country)
                .then(country => { $panel.html(countryMarkup(country)).data('loaded', true); })
                .catch(err => {
                    $panel.html('<div class="api-error" role="alert">' + esc(WW.api.errorMessage(err)) + '</div>');
                })
                .finally(() => $button.prop('disabled', false));
        });

        /* --- country explorer (any country) --- */
        const $result = $('#countryResult');
        function searchCountry(name) {
            $result.html(loadingMarkup);
            return WW.api.getCountry(name)
                .then(country => {
                    $result.html(
                        '<div class="country-facts country-facts--large">' + countryMarkup(country) +
                        '<button type="button" class="btn btn-outline-primary js-fav mt-3" data-country="' + esc(country.name) + '" aria-pressed="false">' +
                        '<span class="fav-icon" aria-hidden="true">♡</span> <span class="fav-label">Save to favourites</span></button></div>');
                    syncFavoriteButtons();
                    WW.data.addSearch(country.name);
                    renderRecent();
                })
                .catch(err => {
                    $result.html('<div class="api-error" role="alert">' + esc(WW.api.errorMessage(err)) +
                        ' <button type="button" class="btn btn-sm btn-outline-primary ms-2" id="retryCountry" data-country="' + esc(name) + '">Try again</button></div>');
                });
        }
        $result.on('click', '#retryCountry', function () { searchCountry(this.dataset.country); });

        WW.validator.attach(document.getElementById('countryForm'), (values, form) => {
            withSpinner($(form).find('button[type="submit"]'), () => searchCountry(values.countryName));
        });

        // Deep link from the profile page: destinations.html?country=Japan
        const deepLink = params.get('country');
        if (deepLink) { $('#countryName').val(deepLink); searchCountry(deepLink); }
    }

    /* ======================================================
       6. FORMS AND ACCOUNTS
       ====================================================== */

    function initContactForm() {
        const form = document.getElementById('contactForm');
        if (!form) return;
        const user = WW.auth.currentUser();
        if (user) { form.name.value = user.name; form.email.value = user.email; form.phone.value = user.phone; }

        WW.validator.attach(form, (values) => {
            withSpinner($(form).find('button[type="submit"]'), () => {
                const messages = WW.store.read('ww_messages', []);
                messages.push(Object.assign({ date: new Date().toISOString() }, values));
                WW.store.write('ww_messages', messages);
            }).then(() => {
                form.reset();
                WW.validator.setStatus(form, 'Thank you! Your message has been saved. This demo does not send data to a server.', 'success');
                showToast('Message sent');
            });
        });
    }

    function initSignupForm() {
        const form = document.getElementById('signupForm');
        if (!form) return;
        if (WW.auth.isLoggedIn()) { window.location.replace('profile.html'); return; }

        WW.validator.attach(form, values => {
            withSpinner($(form).find('button[type="submit"]'), () => WW.auth.signUp(values)).then(result => {
                if (!result.ok) {
                    WW.validator.setError(form.elements[result.field], result.error);
                    WW.validator.setStatus(form, result.error, 'error');
                    return;
                }
                window.location.href = 'login.html?registered=1';
            });
        });
    }

    function initLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;
        if (WW.auth.isLoggedIn()) { window.location.replace('profile.html'); return; }

        const params = new URLSearchParams(window.location.search);
        const $notice = $('#loginNotice');
        if (params.get('registered')) $notice.text('Account created! Please log in.').prop('hidden', false);
        else if (params.get('next')) $notice.text('Please log in to view your profile.').prop('hidden', false);

        WW.validator.attach(form, values => {
            withSpinner($(form).find('button[type="submit"]'), () => WW.auth.logIn(values.email, values.password)).then(result => {
                if (!result.ok) { WW.validator.setStatus(form, result.error, 'error'); return; }
                window.location.href = 'profile.html';
            });
        });
    }

    function initProfile() {
        if (document.body.dataset.auth !== 'required') return;
        const user = WW.auth.currentUser();
        if (!user) return;   // guard() is already redirecting

        $('#profileInitial').text(user.name.charAt(0).toUpperCase());
        $('#profileName').text(user.name);
        $('#profileEmail').text(user.email);
        $('#profilePhone').text(user.phone);
        $('#profileSince').text(new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));

        function renderLists() {
            const favorites = WW.data.getFavorites();
            const searches = WW.data.getSearches();
            const $fav = $('#favoritesList').empty();
            favorites.forEach(name => {
                const $li = $('<li class="saved-item">');
                $('<a>', { href: 'destinations.html?country=' + encodeURIComponent(name), text: name }).appendTo($li);
                $('<button>', { type: 'button', class: 'btn btn-sm btn-outline-secondary', text: 'Remove', 'data-country': name, 'aria-label': 'Remove ' + name }).appendTo($li);
                $fav.append($li);
            });
            $('#favoritesEmpty').prop('hidden', favorites.length > 0);
            const $searches = $('#searchesList').empty();
            searches.forEach(term => {
                $('<li class="saved-item">').append($('<a>', { href: 'destinations.html?q=' + encodeURIComponent(term), text: term })).appendTo($searches);
            });
            $('#searchesEmpty').prop('hidden', searches.length > 0);
            $('#clearFavorites').prop('hidden', !favorites.length);
            $('#clearSearches').prop('hidden', !searches.length);
        }
        renderLists();

        $('#favoritesList').on('click', 'button', function () { WW.data.toggleFavorite(this.dataset.country); renderLists(); showToast('Removed from favourites'); });
        $('#clearFavorites').on('click', () => { WW.data.clearFavorites(); renderLists(); });
        $('#clearSearches').on('click', () => { WW.data.clearSearches(); renderLists(); });
        $('#profileLogout').on('click', () => { WW.auth.logOut(); window.location.href = 'index.html'; });
        $('#deleteAccountBtn').on('click', () => {
            if (window.confirm('Delete your account and all saved data from this browser? This cannot be undone.')) {
                WW.auth.deleteAccount();
                window.location.href = 'index.html';
            }
        });
    }

    /* ======================================================
       START
       ====================================================== */
    $(function () {
        WW.auth.renderNav();
        initScrollProgress();
        initLazyImages();
        initMenuKeyboard();
        initCounters();
        initFaq();
        initIdeaFinder();
        initSubscribePopup();
        initCopyTips();
        initDestinations();
        initContactForm();
        initSignupForm();
        initLoginForm();
        initProfile();
    });
})(jQuery);
