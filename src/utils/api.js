/**
 * apiFetch — production-grade API client with auto-retry, timeout, and auth.
 *
 * - Retries up to `retries` times with exponential backoff (500ms, 1s, 2s…)
 * - Each attempt has a configurable `timeoutMs` (default 10s)
 * - Network errors and 5xx responses trigger retries
 * - 4xx responses are returned immediately (not retried)
 * - Auth token sourced from localStorage (falls back to session cookie)
 */

const getAuthToken = () => {
    // Priority: localStorage > sessionStorage > dev fallback (local only)
    const isLocalDev =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const allowDevBypass =
        localStorage.getItem('horizon_allow_dev_token') === 'true' ||
        sessionStorage.getItem('horizon_allow_dev_token') === 'true';

    return localStorage.getItem('auth_token')
        || sessionStorage.getItem('auth_token')
        || (isLocalDev && allowDevBypass ? 'dev_token_123' : null);
};

export const apiFetch = async (url, options = {}, { retries = 2, timeoutMs = 10000 } = {}) => {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal,
            });
            clearTimeout(timer);

            // 4xx = client error, don't retry (definitive)
            if (response.status >= 400 && response.status < 500) {
                return response;
            }

            // 5xx = server error, retry with backoff
            if (response.status >= 500) {
                lastError = new Error(`Server error: ${response.status}`);
                if (attempt < retries) {
                    await _sleep(500 * Math.pow(2, attempt));
                    continue;
                }
                return response;
            }

            return response; // 2xx/3xx success
        } catch (err) {
            clearTimeout(timer);
            lastError = err;
            if (attempt < retries) {
                await _sleep(500 * Math.pow(2, attempt));
                continue;
            }
        }
    }

    throw lastError ?? new Error('Network request failed after retries');
};

const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
