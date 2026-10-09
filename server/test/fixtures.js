/**
 * Shared sample data for the server unit tests (no database needed).
 * Months are generated relative to "now" so date-dependent logic stays stable.
 */
function monthKey(offset) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 12 months: 2 in the past, the current one, 9 in the future. Each month saves 5,000. */
function sampleCashFlow({ startingBalance = 50000, income = 20000 } = {}) {
    const months = [];
    let balance = startingBalance;
    for (let i = -2; i <= 9; i++) {
        const m = {
            month: `${monthKey(i)}-01T00:00:00.000Z`,
            startingBalance: balance,
            income,
            additionalIncomes: [],
            mortgagePayment: 6000,
            loanPayment: 1000,
            installmentsPayment: 0,
            regularExpenses: [{ description: 'food', amount: 5000 }, { description: 'car', amount: 3000 }],
            specialExpenses: []
        };
        m.endingBalance = balance + income - 6000 - 1000 - 8000; // +5000 per month
        balance = m.endingBalance;
        months.push(m);
    }
    return { months };
}

function sampleGoal(overrides = {}) {
    return {
        id: 'g1',
        name: 'Car',
        type: 'PURCHASE',
        targetAmount: 30000,
        targetDate: monthKey(6),
        priority: 1,
        completed: false,
        ...overrides
    };
}

module.exports = { monthKey, sampleCashFlow, sampleGoal };
