// Recency-weighted random selection helpers.
//
// The goal: newly added locations should show up more often than old ones,
// but nothing should ever be fully excluded — every location keeps a real
// (if small) chance of being picked.

// How many days it takes for a location's "recency boost" to halve.
// Smaller = newer locations dominate harder / for a shorter window.
const RECENCY_HALF_LIFE_DAYS = 21;

// Floor weight so old locations never drop to (near) zero probability.
const MIN_WEIGHT = 0.15;

/**
 * Weight for a single location based on how long ago it was created.
 * Missing/invalid created_at falls back to the floor weight.
 */
export function recencyWeight(createdAt, now = Date.now()) {
    if (!createdAt) return MIN_WEIGHT;
    const createdTime = new Date(createdAt).getTime();
    if (!Number.isFinite(createdTime)) return MIN_WEIGHT;

    const ageDays = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
    const decayed = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
    return Math.max(MIN_WEIGHT, decayed);
}

/**
 * Weighted random sample WITHOUT replacement, using the Efraimidis-Spirakis
 * algorithm: key = random()^(1/weight), take the top `count` keys.
 * This gives every item a nonzero chance while favoring higher weights.
 */
export function weightedSampleWithoutReplacement(items, weights, count, rng = Math.random) {
    const keyed = items.map((item, i) => {
        const weight = Math.max(weights[i], 1e-6);
        const u = Math.min(Math.max(rng(), 1e-9), 1 - 1e-9);
        const key = Math.pow(u, 1 / weight);
        return { item, key };
    });

    keyed.sort((a, b) => b.key - a.key);
    return keyed.slice(0, count).map((entry) => entry.item);
}

/**
 * Deterministic weighted pick for cases (like the daily challenge) where
 * everyone must see the same result for a given seed, but we still want
 * recently-added locations to be more likely over time. `seedFraction`
 * should be a stable value in [0, 1) derived from e.g. today's date.
 */
export function weightedPickDeterministic(items, weights, seedFraction) {
    const total = weights.reduce((sum, w) => sum + Math.max(w, 1e-6), 0);
    let target = Math.min(Math.max(seedFraction, 0), 1) * total;

    for (let i = 0; i < items.length; i++) {
        target -= Math.max(weights[i], 1e-6);
        if (target <= 0) return items[i];
    }

    return items[items.length - 1];
}