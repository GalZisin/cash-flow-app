const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Import Routers
const installmentRoutes = require('./installments'); // Assuming this file exists
const investmentRoutes = require('./investments');   // Now this file exists
const cashFlowRoutes = require('./cash-flow');       // Assuming this file exists

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/installments', installmentRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/cash-flow', cashFlowRoutes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
