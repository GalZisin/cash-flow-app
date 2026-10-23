const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSummary } = require('../services/cashflow-engine');
const aiService = require('../services/ai.service');
const { buildInsightsPrompt, sanitizeDashboard } = require('../services/insights.service');

/**
 * Guard for the provider's per-minute token limit (Groq free tier: 8K tokens/min, the answer's max_tokens included).
 * Compact JSON with numbers and Hebrew runs at ~3 chars per token, so these caps keep a chat prompt
 * under ~5K tokens (+1024 answer) and an insights prompt under ~5K tokens (+2048 answer).
 */
const MAX_CHAT_PROMPT_CHARS = 15000;
const MAX_INSIGHTS_PROMPT_CHARS = 15000;

const sumOf = (items) => items.reduce((s, e) => s + e.amount, 0);
const pad = (n) => String(n).padStart(2, '0');

/** A large but realistic household: 86 months, two multi-part loans, installments, investments with history. */
function largeData() {
    const months = [];
    let balance = 50000;
    for (let i = 0; i < 86; i++) {
        const d = new Date(2026, 1 + i, 1);
        const m = {
            month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01T00:00:00.000Z`,
            startingBalance: balance,
            income: 18300,
            additionalIncomes: [{ description: 'בונוס', amount: 1500 }],
            mortgagePayment: 4901, loanPayment: 2205, installmentsPayment: 605,
            regularExpenses: ['FOOD', 'CAR', 'HOME', 'HEALTH', 'DINING_OUT', 'EDUCATION', 'SHOPPING', 'ENTERTAINMENT']
                .map((category, k) => ({ description: `הוצאה קבועה ${k}`, amount: 400 + k * 100, category })),
            specialExpenses: i % 3 === 0 ? [{ description: 'ביטוח רכב שנתי מקיף', amount: 4800, category: 'CAR' }] : []
        };
        m.endingBalance = balance + 19800 - 7711 - sumOf(m.regularExpenses) - sumOf(m.specialExpenses);
        balance = m.endingBalance;
        months.push(m);
    }

    const loan = (name, parts) => ({
        name, paymentType: 'loan', totalAmount: 150000, startDate: '2025-01-01',
        loanComponents: Array.from({ length: parts }, (_, k) => ({
            id: `${name}-${k}`, description: `רכיב הלוואה ${k}`, totalLoanAmount: 50000, monthlyPayment: 1000,
            installmentsCount: 120, startDate: '2025-01-01', interestRate: 4.5, payoffDate: '2030-01', payoffAmount: 10000
        }))
    });
    const installments = [
        loan('הלוואה מציקה', 2),
        loan('רכב', 3),
        {
            name: 'מטבח נגרות', paymentType: 'milestone', totalAmount: 52000,
            milestones: [1, 2, 3, 4, 5].map(k => ({ id: `m${k}`, description: `שלב ${k} בעבודה`, amount: 10400, date: `${2026 + k}-03-20`, percentage: 20 }))
        },
        { name: 'טלוויזיה', paymentType: 'manual', totalAmount: 6000, monthlyPayment: 500, installmentsCount: 12, startDate: '2026-06-10' }
    ];
    const investments = ['השתלמות מגדל 31.01.2028', 'השתלמות הפניקס 31.05.31', 'פנסיה הפניקס', 'תיק מניות'].map((name, k) => ({
        name, type: 'fund', initialValue: 40000, annualReturn: 5,
        snapshots: Array.from({ length: 13 }, (_, j) => ({ date: `${2025 + Math.floor(j / 12)}-${pad(j % 12 + 1)}-28`, value: 40000 + j * 1000 + k })),
        transactions: Array.from({ length: 24 }, (_, j) => ({ date: `${2024 + Math.floor(j / 12)}-${pad(j % 12 + 1)}-01`, amount: 1000, type: 'deposit' }))
    }));

    return { cashFlow: { months }, installments, investments, defaults: { income: 18300 }, today: '2026-10-23' };
}

const promptChars = (p) => p.system.length + p.user.length;

test('chat prompt for a large household stays inside the provider token budget', () => {
    const summary = buildSummary(largeData());
    const chars = promptChars(aiService.buildChatPrompt(summary, 'כמה אני חוסך בחודש?'));
    assert.ok(chars < MAX_CHAT_PROMPT_CHARS, `chat prompt is ${chars} chars (cap ${MAX_CHAT_PROMPT_CHARS})`);
});

test('insights prompt drops monthlySnapshots and stays inside the token budget with 60 dashboard periods', () => {
    const summary = buildSummary(largeData());
    const dashboard = sanitizeDashboard({
        periods: Array.from({ length: 60 }, (_, i) => ({
            period: `${2026 + Math.floor(i / 12)}-${pad(i % 12 + 1)}`, kind: 'actual',
            income: 19838, expenses: 13984, net: 5854, balance: 100000 + i * 5854, savingsRatePct: 29.5
        }))
    });
    const prompt = buildInsightsPrompt(summary, dashboard, 'he');

    assert.ok(!prompt.user.includes('monthlySnapshots'));
    const chars = promptChars(prompt);
    assert.ok(chars < MAX_INSIGHTS_PROMPT_CHARS, `insights prompt is ${chars} chars (cap ${MAX_INSIGHTS_PROMPT_CHARS})`);
});
