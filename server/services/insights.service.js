/**
 * AI insights for the AI assistant dashboard.
 *
 * The model gets the server summary (from the database) plus the dashboard snapshot the user is looking at
 * (KPIs, trend periods, projection assumptions), and must answer with JSON: a short list of typed insights.
 * The result is saved to the AI reports archive here, so a successful generation is always archived.
 */
const aiService = require('./ai.service');
const aiReportsService = require('./aiReports.service');
const logger = require('../utils/logger');
const traceMethods = require('../utils/traceMethods');

const TYPES = ['positive', 'warning', 'risk', 'tip'];
const MAX_PERIODS = 60;
const MAX_INSIGHTS = 6;
/** 4-5 insights in Hebrew are ~600-900 tokens; leave room for the model's (low effort) reasoning. */
const MAX_TOKENS = 2048;

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
};
const pct = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
};
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
/** Period keys / month keys only (2026, 2026-Q1, 2026-03), never free text from the client. */
const periodKey = (v) => (/^\d{4}(-Q[1-4]|-\d{2})?$/.test(String(v)) ? String(v) : null);

/**
 * Keeps only the known numeric fields of the dashboard snapshot sent by the client.
 * Nothing the client sends reaches the prompt as free text.
 */
function sanitizeDashboard(input) {
    const d = input && typeof input === 'object' ? input : {};
    const k = d.kpis || {};
    const t = d.trends || {};
    const s = t.settings || {};
    const sum = t.summary || {};
    const periods = Array.isArray(t.periods) ? t.periods : [];

    return {
        kpis: {
            balanceToday: num(k.balanceToday),
            totalInvestments: num(k.totalInvestments),
            activeInstallments: num(k.activeInstallments),
            monthlyInstallmentsPayment: num(k.monthlyInstallmentsPayment)
        },
        trends: {
            settings: {
                period: oneOf(s.period, ['month', 'quarter', 'year'], 'month'),
                range: oneOf(s.range, ['1y', '3y', '5y', 'all'], 'all'),
                projectionYears: num(s.projectionYears),
                incomeGrowthPctPerYear: pct(s.incomeGrowthPct),
                expenseGrowthPctPerYear: pct(s.expenseGrowthPct),
                projectionBasisMonths: num(s.basisMonths)
            },
            summary: {
                months: num(sum.months),
                avgMonthlyIncome: num(sum.avgIncome),
                avgMonthlyExpenses: num(sum.avgExpenses),
                avgMonthlyNet: num(sum.avgNet),
                savingsRatePct: pct(sum.savingsRatePct),
                balanceNow: num(sum.balanceNow),
                balanceAtEnd: num(sum.balanceEnd),
                endMonth: periodKey(sum.endKey)
            },
            periods: periods.slice(-MAX_PERIODS).map((p) => ({
                period: periodKey(p?.period),
                kind: oneOf(p?.kind, ['actual', 'planned', 'projected'], 'actual'),
                income: num(p?.income),
                expenses: num(p?.expenses),
                net: num(p?.net),
                endBalance: num(p?.balance),
                savingsRatePct: pct(p?.savingsRatePct)
            })).filter((p) => p.period)
        }
    };
}

function buildInsightsPrompt(summary, dashboard, lang) {
    const language = lang === 'en' ? 'English' : 'Hebrew';
    const system = `You are a personal financial advisor.
Rules you MUST follow:
- Use ONLY the numbers in the two JSON blocks. NEVER invent numbers.
- Periods with kind "projected" are estimates from the user's own assumptions; say so when you cite them. "planned" periods come from the user's plan.
- Answer with ONE valid JSON object and nothing else: no markdown, no tables, no code fences.`;

    const user = `## Financial summary (from the database)
${JSON.stringify(summary)}

## Dashboard the user is looking at (KPIs, trend periods, projection assumptions)
${JSON.stringify(dashboard)}

## Task
Write 4 or 5 short, proactive insights about this user's finances. Cover, where the data allows:
- the savings trend and savings rate,
- income vs expenses over time (which one grows faster, deficit periods),
- the projected balance under the user's assumptions,
- loans / installments burden and investments,
- one concrete action the user can take.
Each insight: "type" is one of "positive", "warning", "risk", "tip"; "title" is at most 6 words; "text" is 1-2 sentences that cite specific numbers with ₪.
Write every title and text in ${language}.

Return exactly this shape:
{"insights":[{"type":"positive","title":"...","text":"..."}]}`;

    return { system, user };
}

const stripMarkdown = (s) => String(s)
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/^#+\s*/, '')
    .trim();

/**
 * Parses the model answer into [{ type, title, text }].
 * Prefers the JSON object; if the model ignored the format, falls back to bullet lines
 * (headings, table rows and separators are dropped).
 */
function parseInsights(answer) {
    const text = String(answer || '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try {
            const parsed = JSON.parse(text.slice(start, end + 1));
            const list = Array.isArray(parsed) ? parsed : parsed.insights;
            if (Array.isArray(list)) {
                const items = list
                    .map((i) => ({
                        type: oneOf(String(i?.type || '').toLowerCase(), TYPES, 'tip'),
                        title: stripMarkdown(i?.title || ''),
                        text: stripMarkdown(i?.text || '')
                    }))
                    .filter((i) => i.text);
                if (items.length) return items.slice(0, MAX_INSIGHTS);
            }
        } catch { /* fall through to the line parser */ }
    }

    return text.split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('|') && !l.startsWith('#') && !l.startsWith('```') && !/^[-=*_\s]+$/.test(l) && !l.startsWith('{'))
        .map((l) => ({ type: 'tip', title: '', text: stripMarkdown(l) }))
        .filter((i) => i.text.length > 5)
        .slice(0, MAX_INSIGHTS);
}

/** One line per insight for the archive (rendered with the same bold formatting as the dashboard). */
const toArchiveLine = (i) => (i.title ? `**${i.title}** — ${i.text}` : i.text);

class InsightsService {
    /**
     * Generates insights and archives them.
     * @returns {Promise<{ model: string, insights: Array, report: object|null, archived: boolean }>}
     */
    async generate(summary, dashboardInput, lang) {
        const dashboard = sanitizeDashboard(dashboardInput);
        const model = aiService.getConfig().model;
        const answer = await aiService.generate(buildInsightsPrompt(summary, dashboard, lang), { maxTokens: MAX_TOKENS });
        const insights = parseInsights(answer);
        if (!insights.length) {
            logger.warn('AI insights: empty or unparsable answer', { length: String(answer || '').length });
            return { model, insights, report: null, archived: false };
        }

        let report = null;
        try {
            report = await aiReportsService.createReport({
                type: 'insights',
                content: insights.map(toArchiveLine),
                items: insights,
                model,
                lang: lang === 'en' ? 'en' : 'he',
                createdAt: new Date().toISOString()
            });
        } catch (err) {
            // The insights are still useful without the archive (e.g. DB hiccup): return them and say so.
            logger.error('AI insights: archive save failed', { error: err.message });
        }
        return { model, insights, report, archived: !!report };
    }
}

const insightsService = traceMethods(new InsightsService(), 'insightsService');
module.exports = Object.assign(insightsService, { sanitizeDashboard, buildInsightsPrompt, parseInsights, toArchiveLine });
