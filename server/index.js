const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Import Routers
const installmentRoutes = require('./installments');
const investmentRoutes = require('./investments');
const cashFlowRoutes = require('./cash-flow');
const aiRoutes = require('./ai.routes');

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/installments', installmentRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api', cashFlowRoutes);
app.use('/api/ai', aiRoutes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
