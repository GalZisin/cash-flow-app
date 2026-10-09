/**
 * Builds the compact financial summary that every AI call uses, with a short TTL cache.
 *
 * The summary is identical for every question asked in a row, so it is cached for
 * AI_SUMMARY_CACHE_MS (default 60s). Any mutating /api request invalidates it (see app.js),
 * so a save is reflected immediately.
 */
const cashFlowRepository = require('../repositories/cashFlow.repository');
const installmentsRepository = require('../repositories/installments.repository');
const investmentsRepository = require('../repositories/investments.repository');
const { buildSummary } = require('./cashflow-engine');

const CACHE_MS = Number(process.env.AI_SUMMARY_CACHE_MS ?? 60_000);

class FinancialSummaryService {
    constructor() {
        this.cached = null;   // { summary, expiresAt }
        this.pending = null;  // in-flight build, shared by concurrent callers
    }

    /** Loads everything the summary needs from the database (one parallel round trip). */
    async loadAllData() {
        const [cashFlow, defaults, installments, investments] = await Promise.all([
            cashFlowRepository.read(),
            cashFlowRepository.readDefaults(),
            installmentsRepository.findAll(),
            investmentsRepository.findAll()
        ]);
        return { cashFlow, defaults, installments, investments };
    }

    /** Fresh summary, bypassing the cache. */
    async build() {
        return buildSummary(await this.loadAllData());
    }

    /** Cached summary (shared between concurrent requests). */
    async getSummary() {
        const now = Date.now();
        if (this.cached && this.cached.expiresAt > now) return this.cached.summary;
        if (this.pending) return this.pending;

        this.pending = this.build()
            .then((summary) => {
                if (CACHE_MS > 0) this.cached = { summary, expiresAt: Date.now() + CACHE_MS };
                return summary;
            })
            .finally(() => { this.pending = null; });
        return this.pending;
    }

    invalidate() {
        this.cached = null;
    }
}

module.exports = new FinancialSummaryService();
