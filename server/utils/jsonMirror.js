const path = require('path');
const fileStorage = require('./fileStorage');

const DATA_DIRECTORY = path.join(__dirname, '..', 'data');
let mirrorQueue = Promise.resolve();

function mirrorMethods(repository, methods) {
    for (const [methodName, snapshots] of Object.entries(methods)) {
        const original = repository[methodName].bind(repository);
        repository[methodName] = async (...args) => {
            const result = await original(...args);
            if (process.env.CASHFLOW_SKIP_JSON_MIRROR === '1') return result;

            const writeSnapshot = mirrorQueue.catch(() => { }).then(async () => {
                for (const snapshot of snapshots) {
                    if (snapshot.when && !snapshot.when(result)) continue;
                    const data = await snapshot.load(repository);
                    await fileStorage.writeJSON(
                        path.join(DATA_DIRECTORY, snapshot.file),
                        snapshot.serialize ? snapshot.serialize(data) : data
                    );
                }
            });

            mirrorQueue = writeSnapshot.catch(() => { });
            await writeSnapshot;
            return result;
        };
    }

    return repository;
}

module.exports = { mirrorMethods };
