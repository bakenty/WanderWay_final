/**
 * validator.js — custom form validation (no HTML validation attributes).
 *
 * Fields opt in with data attributes:
 *   data-rules="required email"      rules are checked in order, first failure wins
 *   data-label="email address"       used in the "required" message
 *   data-match="#password"           value must equal another field (rule "match")
 *   data-min="10"                    minimum length (rule "minlength")
 * Error messages are rendered inline under the field.
 */
window.WW = window.WW || {};

WW.validator = (function () {
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var NAME_RE = /^[\p{L}][\p{L}\s'’.-]{1,49}$/u;
    var PHONE_RE = /^\+?[0-9][0-9\s().-]{8,19}$/;
    var COUNTRY_RE = /^[\p{L}][\p{L}\s'’.()-]{1,59}$/u;

    /** Each rule returns an error string, or '' when the value is valid. */
    var rules = {
        required: function (v, f) {
            return v.trim() === '' ? 'Please enter your ' + (f.dataset.label || 'information') + '.' : '';
        },
        name: function (v) {
            return NAME_RE.test(v.trim()) ? '' : 'Use 2–50 letters (spaces, hyphens and apostrophes are allowed).';
        },
        email: function (v) {
            return EMAIL_RE.test(v.trim()) ? '' : 'Enter a valid email address, for example name@example.com.';
        },
        phone: function (v) {
            var digits = v.replace(/\D/g, '');
            return PHONE_RE.test(v.trim()) && digits.length >= 10 && digits.length <= 15
                ? '' : 'Enter a valid phone number with 10–15 digits, for example +7 701 234 56 78.';
        },
        password: function (v) {
            if (v.length < 8) return 'Password must be at least 8 characters long.';
            if (!/[a-z]/.test(v)) return 'Password must include a lowercase letter.';
            if (!/[A-Z]/.test(v)) return 'Password must include an uppercase letter.';
            if (!/[0-9]/.test(v)) return 'Password must include a number.';
            return '';
        },
        match: function (v, f) {
            var other = document.querySelector(f.dataset.match);
            return other && v === other.value ? '' : 'Passwords do not match.';
        },
        minlength: function (v, f) {
            var min = parseInt(f.dataset.min, 10) || 0;
            return v.trim().length >= min
                ? '' : 'Please write at least ' + min + ' characters (you have ' + v.trim().length + ').';
        },
        country: function (v) {
            return COUNTRY_RE.test(v.trim()) ? '' : 'Enter a country name using letters only, for example Japan.';
        },
        selected: function (v) {
            return v ? '' : 'Please choose an option.';
        }
    };

    /** Returns (creating if needed) the inline error element of a field. */
    function errorBox(field) {
        var holder = field.closest('.field-group') || field.parentElement;
        var box = holder.querySelector('.field-error');
        if (!box) {
            box = document.createElement('div');
            box.className = 'field-error';
            box.id = (field.id || field.name || 'field') + 'Error';
            box.setAttribute('role', 'alert');
            holder.appendChild(box);
        }
        return box;
    }

    function setError(field, message) {
        var box = errorBox(field);
        box.textContent = message;
        field.classList.toggle('is-invalid', !!message);
        field.classList.toggle('is-valid', !message && field.value !== '');
        if (message) {
            field.setAttribute('aria-invalid', 'true');
            field.setAttribute('aria-describedby', box.id);
        } else {
            field.removeAttribute('aria-invalid');
            field.removeAttribute('aria-describedby');
        }
    }

    /** Validates one field, shows/clears its message, returns true if valid. */
    function validateField(field) {
        var list = (field.dataset.rules || '').split(/\s+/).filter(Boolean);
        var value = field.value;
        var isRequired = list.indexOf('required') !== -1;
        var message = '';
        if (value.trim() === '' && !isRequired) { setError(field, ''); field.classList.remove('is-valid'); return true; }
        for (var i = 0; i < list.length; i++) {
            if (rules[list[i]]) message = rules[list[i]](value, field);
            if (message) break;
        }
        setError(field, message);
        return !message;
    }

    function setStatus(form, text, type) {
        var status = form.querySelector('.form-status');
        if (!status) return;
        status.textContent = text || '';
        status.className = 'form-status' + (text ? ' form-status--' + (type || 'info') : '');
    }

    /**
     * Wires a form: blocks native validation, validates on blur/input/submit and
     * calls onValid(values, form) only when every field passes.
     */
    function attach(form, onValid) {
        if (!form) return;
        form.setAttribute('novalidate', '');
        var fields = Array.prototype.slice.call(form.querySelectorAll('[data-rules]'));
        var touched = new WeakSet();

        fields.forEach(function (field) {
            field.addEventListener('blur', function () {
                if (field.value !== '' || touched.has(field)) { touched.add(field); validateField(field); }
            });
            field.addEventListener('input', function () {
                if (touched.has(field) || field.classList.contains('is-invalid')) validateField(field);
                // Re-check fields that depend on this one (e.g. "confirm password").
                fields.forEach(function (other) {
                    if (other.dataset.match === '#' + field.id && other.value !== '') validateField(other);
                });
            });
            field.addEventListener('change', function () { if (field.tagName === 'SELECT') validateField(field); });
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            setStatus(form, '');
            var firstInvalid = null;
            fields.forEach(function (field) {
                touched.add(field);
                if (!validateField(field) && !firstInvalid) firstInvalid = field;
            });
            if (firstInvalid) {
                firstInvalid.focus();
                setStatus(form, 'Please fix the highlighted fields and try again.', 'error');
                return;
            }
            var values = {};
            new FormData(form).forEach(function (val, key) { values[key] = typeof val === 'string' ? val.trim() : val; });
            onValid(values, form);
        });

        form.addEventListener('reset', function () {
            fields.forEach(function (field) { setError(field, ''); field.classList.remove('is-valid'); });
            setStatus(form, '');
        });
    }

    return { attach: attach, validateField: validateField, setError: setError, setStatus: setStatus };
})();
