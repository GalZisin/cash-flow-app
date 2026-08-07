const fileStorage = require('../utils/fileStorage');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/investments.json');

class InvestmentsRepository {
    async findAll() {
        return await fileStorage.readJSON(DATA_FILE, []);
    }

    async findById(id) {
        const items = await this.findAll();
        return items.find(item => item.id === id) || null;
    }

    async create(data) {
        const items = await this.findAll();
        items.push(data);
        await fileStorage.writeJSON(DATA_FILE, items);
        return data;
    }

    async update(id, data) {
        const items = await this.findAll();
        const index = items.findIndex(item => item.id === id);

        if (index === -1) {
            return null;
        }

        items[index] = { ...items[index], ...data, id };
        await fileStorage.writeJSON(DATA_FILE, items);
        return items[index];
    }

    async delete(id) {
        const items = await this.findAll();
        const filtered = items.filter(item => item.id !== id);

        if (items.length === filtered.length) {
            return false;
        }

        await fileStorage.writeJSON(DATA_FILE, filtered);
        return true;
    }
}

module.exports = new InvestmentsRepository();
