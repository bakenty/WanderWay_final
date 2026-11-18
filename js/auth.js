/**
 * auth.js — Sign Up / Log In simulation using localStorage (no backend).
 *
 * Storage keys:
 *   ww_users    array of { id, name, email, phone, salt, passwordHash, createdAt }
 *   ww_session  email of the logged-in user
 *
 * NOTE: this is a classroom simulation. Passwords are salted and hashed with
 * SHA-256 so they are never kept as plain text, but real sites must use a server.
 */
window.WW = window.WW || {};

WW.auth = (function () {
    var USERS_KEY = 'ww_users';
    var SESSION_KEY = 'ww_session';

    function users() { return WW.store.read(USERS_KEY, []); }
    function normalizeEmail(email) { return String(email).trim().toLowerCase(); }

    /** SHA-256 hex digest of salt + password (falls back to base64 if Web Crypto is unavailable). */
    function hashPassword(password, salt) {
        var text = salt + ':' + password;
        if (window.crypto && window.crypto.subtle && window.TextEncoder) {
            return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buffer) {
                return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
                    return b.toString(16).padStart(2, '0');
                }).join('');
            });
        }
        return Promise.resolve('b64:' + btoa(unescape(encodeURIComponent(text))));
    }

    function randomSalt() {
        var bytes = new Uint8Array(12);
        (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(bytes)
            : bytes.forEach(function (_, i) { bytes[i] = Math.floor(Math.random() * 256); });
        return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    function currentUser() {
        var email = WW.store.read(SESSION_KEY, null);
        if (!email) return null;
        return users().find(function (u) { return u.email === email; }) || null;
    }

    /** Creates an account. Resolves { ok, error?, field? }. */
    function signUp(details) {
        var email = normalizeEmail(details.email);
        if (users().some(function (u) { return u.email === email; })) {
            return Promise.resolve({ ok: false, field: 'email', error: 'An account with this email already exists. Try logging in.' });
        }
        var salt = randomSalt();
        return hashPassword(details.password, salt).then(function (hash) {
            var list = users();
            list.push({
                id: 'u' + Date.now().toString(36),
                name: details.name.trim(),
                email: email,
                phone: details.phone.trim(),
                salt: salt,
                passwordHash: hash,
                createdAt: new Date().toISOString()
            });
            WW.store.write(USERS_KEY, list);
            return { ok: true };
        });
    }

    /** Checks credentials and starts a session. Resolves { ok, error? }. */
    function logIn(emailInput, password) {
        var email = normalizeEmail(emailInput);
        var user = users().find(function (u) { return u.email === email; });
        var failure = { ok: false, error: 'Incorrect email or password.' };
        if (!user) return Promise.resolve(failure);
        return hashPassword(password, user.salt).then(function (hash) {
            if (hash !== user.passwordHash) return failure;
            WW.store.write(SESSION_KEY, user.email);
            WW.data.mergeGuestInto(user.email);
            return { ok: true };
        });
    }

    function logOut() { WW.store.remove(SESSION_KEY); }

    function deleteAccount() {
        var user = currentUser();
        if (!user) return;
        WW.store.write(USERS_KEY, users().filter(function (u) { return u.id !== user.id; }));
        WW.data.deleteOwner(user.email);
        logOut();
    }

    /** Builds the Log in / Sign up (or Profile / Log out) buttons in the navbar. */
    function renderNav() {
        var holder = document.getElementById('authNav');
        if (!holder) return;
        var user = currentUser();
        holder.textContent = '';

        function link(href, text, cls) {
            var a = document.createElement('a');
            a.href = href; a.className = 'btn btn-sm ' + cls; a.textContent = text;
            return a;
        }
        if (user) {
            holder.appendChild(link('profile.html', '👤 ' + user.name.split(/\s+/)[0], 'btn-outline-light nav-auth-btn'));
            var out = document.createElement('button');
            out.type = 'button'; out.id = 'logoutBtn'; out.className = 'btn btn-sm btn-light nav-auth-btn'; out.textContent = 'Log out';
            out.addEventListener('click', function () { logOut(); window.location.href = 'index.html'; });
            holder.appendChild(out);
        } else {
            holder.appendChild(link('login.html', 'Log in', 'btn-outline-light nav-auth-btn'));
            holder.appendChild(link('signup.html', 'Sign up', 'btn-light nav-auth-btn'));
        }
    }

    /** Pages marked <body data-auth="required"> redirect guests to the login page. */
    function guard() {
        if (document.body.dataset.auth === 'required' && !currentUser()) {
            window.location.replace('login.html?next=profile');
        }
    }

    return {
        signUp: signUp, logIn: logIn, logOut: logOut, deleteAccount: deleteAccount,
        currentUser: currentUser, isLoggedIn: function () { return !!currentUser(); },
        renderNav: renderNav, guard: guard
    };
})();
