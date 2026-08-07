const fileStorage = require('../utils/fileStorage');
const path = require('path');

// Use the most recent data file (miluim version)
const DATA_FILE = path.join(__dirname, '../data/cash-flow-data-miluim.json');
const DEFAULTS_FILE = path.join(__dirname, '../data/cash-flow-defaults.json');

class CashFlowRepository {
    async read() {
        return await fileStorage.readJSON(DATA_FILE, null);
    }

    async write(data) {
        return await fileStorage.writeJSON(DATA_FILE, data);
    }

    async readDefaults() {
        const defaultStructure = {
            income: 0,
            mortgagePayment: 0,
            loanPayment: 0,
            additionalIncomes: [],
            regularExpenses: [],
            specialExpenses: []
        };
        return await fileStorage.readJSON(DEFAULTS_FILE, defaultStructure);
    }

    async writeDefaults(data) {
        return await fileStorage.writeJSON(DEFAULTS_FILE, data);
    }
}

module.exports = new CashFlowRepository();
