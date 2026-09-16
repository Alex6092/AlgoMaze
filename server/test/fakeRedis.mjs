// Faux Redis en mémoire pour les tests locaux (pas de serveur Redis nécessaire).
// Implémente le sous-ensemble de l'API node-redis v4 utilisé par AlgoMaze :
// get/set/exists/keys/del/incr, listes (lPush/rPush/lRange/lTrim/lRem/lMove/blMove).
// Toutes les instances créées via createClient() partagent le même store, comme
// plusieurs connexions vers un même serveur Redis.
//
// Activé via test/loader.mjs qui redirige `import ... from 'redis'` vers ce module.

const store = {
    strings: new Map(),
    lists: new Map()
};

function globToRegex(pattern) {
    let re = '^';
    for (const ch of pattern) {
        if (ch === '*') re += '.*';
        else if (ch === '?') re += '.';
        else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(re + '$');
}

function normalizeRange(list, start, stop) {
    const len = list.length;
    let s = start < 0 ? len + start : start;
    let e = stop < 0 ? len + stop : stop;
    if (s < 0) s = 0;
    if (e >= len) e = len - 1;
    return [s, e];
}

const waiters = []; // { src, resolve } en attente sur blMove

function notifyList(key) {
    for (let i = 0; i < waiters.length; i++) {
        if (waiters[i].src === key) {
            const w = waiters.splice(i, 1)[0];
            w.resolve();
            return;
        }
    }
}

class FakeRedisClient {
    constructor() { this.connected = false; }
    on() { return this; }
    async connect() {
        this.connected = true;
        if (process.env.FAKE_REDIS_SEED && !store.seeded) {
            store.seeded = true;
            const { seed } = await import('./seed.mjs');
            await seed(this);
        }
        return this;
    }
    async quit() { this.connected = false; }
    async disconnect() { this.connected = false; }

    async get(key) {
        return store.strings.has(key) ? store.strings.get(key) : null;
    }
    async set(key, value) {
        store.strings.set(key, String(value));
        return 'OK';
    }
    async exists(key) {
        return (store.strings.has(key) || store.lists.has(key)) ? 1 : 0;
    }
    async keys(pattern) {
        const re = globToRegex(pattern);
        const out = [];
        for (const k of store.strings.keys()) if (re.test(k)) out.push(k);
        for (const k of store.lists.keys()) if (re.test(k)) out.push(k);
        return out;
    }
    async del(key) {
        let n = 0;
        if (store.strings.delete(key)) n++;
        if (store.lists.delete(key)) n++;
        return n;
    }
    async incr(key) {
        const cur = parseInt(store.strings.get(key) || '0', 10) || 0;
        store.strings.set(key, String(cur + 1));
        return cur + 1;
    }

    _list(key, create) {
        let l = store.lists.get(key);
        if (!l && create) { l = []; store.lists.set(key, l); }
        return l || [];
    }
    async lPush(key, value) {
        const l = this._list(key, true);
        l.unshift(String(value));
        notifyList(key);
        return l.length;
    }
    async rPush(key, value) {
        const l = this._list(key, true);
        l.push(String(value));
        notifyList(key);
        return l.length;
    }
    async lRange(key, start, stop) {
        const l = this._list(key, false);
        if (!l.length) return [];
        const [s, e] = normalizeRange(l, start, stop);
        return s > e ? [] : l.slice(s, e + 1);
    }
    async lTrim(key, start, stop) {
        const l = this._list(key, false);
        if (!l.length) return 'OK';
        const [s, e] = normalizeRange(l, start, stop);
        const kept = s > e ? [] : l.slice(s, e + 1);
        store.lists.set(key, kept);
        return 'OK';
    }
    async lRem(key, count, value) {
        const l = this._list(key, false);
        let removed = 0;
        const v = String(value);
        if (count >= 0) {
            for (let i = 0; i < l.length && (count === 0 || removed < count);) {
                if (l[i] === v) { l.splice(i, 1); removed++; } else i++;
            }
        } else {
            for (let i = l.length - 1; i >= 0 && removed < -count; i--) {
                if (l[i] === v) { l.splice(i, 1); removed++; }
            }
        }
        return removed;
    }
    async lMove(src, dst, from, to) {
        const s = this._list(src, false);
        if (!s.length) return null;
        const v = from === 'LEFT' ? s.shift() : s.pop();
        const d = this._list(dst, true);
        if (to === 'LEFT') d.unshift(v); else d.push(v);
        notifyList(dst);
        return v;
    }
    async blMove(src, dst, from, to, timeout) {
        const deadline = timeout > 0 ? Date.now() + timeout * 1000 : null;
        while (true) {
            const v = await this.lMove(src, dst, from, to);
            if (v !== null) return v;
            if (deadline && Date.now() >= deadline) return null;
            await new Promise(resolve => {
                waiters.push({ src, resolve });
                if (deadline) setTimeout(resolve, Math.max(10, deadline - Date.now()));
            });
        }
    }
}

export function createClient() {
    return new FakeRedisClient();
}

export const _store = store;
