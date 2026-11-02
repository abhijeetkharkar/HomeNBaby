/**
 * Normalizes a plant name for case-insensitive duplicate detection and search:
 * trims, collapses internal whitespace and lowercases.
 * Used for catalog lookups now and for staging de-duplication later.
 */
function normalizePlantName(name) {
    return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

module.exports = { normalizePlantName };
