/**
 * API-клиент Launch Library 2: https://ll.thespacedevs.com/2.3.0/
 *
 * Оригинальный SpaceX-API (https://api.spacexdata.com) больше не работает,
 * поэтому данные берём из Launch Library 2. У этого API эндпоинты во
 * множественном числе: /launches/, /pads/, а у каждого запуска есть
 * вложенное поле `pad` — стартовая площадка, с которой он стартовал.
 *
 * Документация: https://ll.thespacedevs.com/docs/
 *
 * У анонимных запросов лимит 15 запросов в час, поэтому ответы кэшируются
 * в localStorage: перезагрузка страницы не тратит квоту, пока кэш свежий.
 */

// сколько держим ответы в кэше: запуски обновляются чаще, площадки почти не меняются
const CACHE_TTL = {
    launches: 30 * 60 * 1000,   // 30 минут
    pads: 24 * 60 * 60 * 1000   // сутки
};
const CACHE_PREFIX = "launch-library:";

/**
 * Необязательно: токен с https://thespacedevs.com/llapi (регистрация → Profile).
 * Без него лимит 15 запросов в час, с токеном — 150. Можно оставить пустым.
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

    /**
     * Последние состоявшиеся запуски.
     * scope "spacex" (по умолчанию) — только запуски SpaceX (lsp__id=121),
     * scope "all" — запуски всех организаций со всего мира.
     */
    launches(limit = 30, scope = "spacex") {
        const lspFilter = scope === "spacex" ? "&lsp__id=121" : "";
        return this.get(`${this.baseUrl}/launches/previous/?limit=${limit}&ordering=-net${lspFilter}`, CACHE_TTL.launches)
            .then(page => page.results);
    }

    /**
     * Все стартовые площадки одним плоским массивом.
     * API отдаёт максимум 100 площадок за раз, поэтому проходим по страницам (page.next).
     */
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
