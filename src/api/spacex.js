
// сколько держим ответы в кэше: запуски обновляются чаще, площадки почти не меняются
const CACHE_TTL = {
    launches: 30 * 60 * 1000,   // 30 минут
    pads: 24 * 60 * 60 * 1000   // сутки
};
const CACHE_PREFIX = "launch-library:";

/**
 * Необязательно: токен с https://thespacedevs.com/llapi (регистрация Profile).
 */
const API_TOKEN = "";

function readCache(url, ttl) {
    try {
        if (typeof localStorage === "undefined") return null;
        const raw = localStorage.getItem(CACHE_PREFIX + url);
        if (raw === null) return null;
        const entry = JSON.parse(raw);
        if (!entry || Date.now() - entry.time > ttl) {
            localStorage.removeItem(CACHE_PREFIX + url); // протухло — удаляем
            return null;
        }
        return entry.data;
    } catch (error) {
        return null; // приватный режим браузера и т.п. — просто идём в сеть
    }
}

function writeCache(url, data) {
    try {
        if (typeof localStorage === "undefined") return;
        localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({time: Date.now(), data}));
    } catch (error) {
        // не удалось записать (например, переполнено хранилище) — просто не кэшируем
    }
}

class SpaceX {

    constructor(baseUrl = "https://ll.thespacedevs.com/2.3.0") {
        this.baseUrl = baseUrl;
    }

    get(url, ttl) {
        const cached = readCache(url, ttl);
        if (cached !== null) {
            return Promise.resolve(cached);
        }
        return fetch(url, {
            headers: API_TOKEN ? {Authorization: `Token ${API_TOKEN}`} : {}
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API request failed (${response.status}): ${url}`);
                }
                return response.json();
            })
            .then(data => {
                writeCache(url, data);
                return data;
            });
    }

    launches(limit = 30, scope = "spacex") {
        const lspFilter = scope === "spacex" ? "&lsp__id=121" : "";
        return this.get(`${this.baseUrl}/launches/previous/?limit=${limit}&ordering=-net${lspFilter}`, CACHE_TTL.launches)
            .then(page => page.results);
    }

    launchpads() {
        const fetchPage = (url, acc = []) => this.get(url, CACHE_TTL.pads).then(page => {
            const pads = acc.concat(page.results);
            return page.next ? fetchPage(page.next, pads) : pads;
        });
        return fetchPage(`${this.baseUrl}/pads/?limit=100`);
    }

    /** Одна стартовая площадка по id. */
    launchpad(id) {
        return this.get(`${this.baseUrl}/pads/${id}/`, CACHE_TTL.pads);
    }

}

export {SpaceX}
