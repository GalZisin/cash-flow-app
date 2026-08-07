# 🏗️ תכנית Refactoring - Server Backend

## 📊 מצב נוכחי (Before)

```
server/
├── index.js                        # Main server + routing
├── installments.js                 # Routes + Logic + File I/O
├── investments.js                  # Routes + Logic + File I/O
├── cash-flow.js                    # Routes + Logic + File I/O
├── ai.routes.js                    # Routes
├── ai.service.js                   # Logic
├── ai-reports.js                   # Routes + Logic + File I/O
├── conversations.js                # Routes + Logic + File I/O
├── cashflow-engine.js              # Business Logic
├── installments.json               # Data (mixed with code)
├── investments.json                # Data
├── cash-flow-data.json            # Data
├── cash-flow-data-miluim.json     # Data
├── cash-flow-data-1.json          # Data
├── cash-flow-data-3.json          # Data
├── cash-flow-data-child.json      # Data
├── cash-flow-defaults.json        # Data
├── conversations.json              # Data
└── data/
    └── ai-reports.json
```

### 🔴 בעיות:
1. **קבצי JSON מעורבבים עם קוד**
2. **אין הפרדה ברורה בין routes/services/data**
3. **קוד משוכפל (read/write JSON)**
4. **אין validation**
5. **אין error handling אחיד**
6. **קשה לתחזוקה ובדיקות**

---

## 🎯 מטרת Refactoring

### מבנה חדש מקצועי:

```
server/
├── index.js                    # Entry point בלבד
├── config/
│   ├── database.js            # DB config (future)
│   └── constants.js           # קבועים
├── routes/
│   ├── index.js               # Route aggregator
│   ├── cashFlow.routes.js     # Cash flow endpoints
│   ├── installments.routes.js # Installments endpoints
│   ├── investments.routes.js  # Investments endpoints
│   ├── ai.routes.js           # AI endpoints
│   ├── conversations.routes.js # Conversations endpoints
│   └── aiReports.routes.js    # AI Reports endpoints
├── services/
│   ├── cashFlow.service.js    # Business logic
│   ├── installments.service.js
│   ├── investments.service.js
│   ├── ai.service.js
│   ├── conversations.service.js
│   └── aiReports.service.js
├── repositories/
│   ├── cashFlow.repository.js # Data access layer
│   ├── installments.repository.js
│   ├── investments.repository.js
│   ├── conversations.repository.js
│   └── aiReports.repository.js
├── utils/
│   ├── fileStorage.js         # Generic file I/O
│   ├── validation.js          # Input validation
│   ├── errorHandler.js        # Error handling
│   └── logger.js              # Logging
├── middleware/
│   ├── errorMiddleware.js     # Global error handler
│   └── validationMiddleware.js # Request validation
├── models/
│   ├── CashFlow.js            # Data models (for validation)
│   ├── Installment.js
│   ├── Investment.js
│   └── Conversation.js
├── data/                       # כל קבצי ה-JSON כאן!
│   ├── cash-flow-data.json
│   ├── cash-flow-defaults.json
│   ├── installments.json
│   ├── investments.json
│   ├── conversations.json
│   └── ai-reports.json
└── package.json
```

---

## 🎨 אדריכלות שכבות (Layered Architecture)

```
┌─────────────────────────────────────────┐
│         HTTP Request (Express)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         ROUTES (controllers)            │
│  • Validate request                     │
│  • Call service layer                   │
│  • Format response                      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         SERVICES (business logic)       │
│  • Business rules                       │
│  • Data transformation                  │
│  • Orchestrate repositories             │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       REPOSITORIES (data access)        │
│  • Read/Write JSON files                │
│  • Future: DB queries                   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              DATA LAYER                 │
│         (JSON files / Database)         │
└─────────────────────────────────────────┘
```

---

## 📝 דוגמה מפורטת - Cash Flow

### 1. Route Layer
**File**: `routes/cashFlow.routes.js`

```javascript
const express = require('express');
const router = express.Router();
const cashFlowService = require('../services/cashFlow.service');
const { validateCashFlowData } = require('../middleware/validationMiddleware');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/cash-flow
router.get('/', asyncHandler(async (req, res) => {
  const data = await cashFlowService.getCashFlow();
  res.json(data);
}));

// POST /api/cash-flow
router.post('/', validateCashFlowData, asyncHandler(async (req, res) => {
  const result = await cashFlowService.saveCashFlow(req.body);
  res.json(result);
}));

// GET /api/cash-flow-defaults
router.get('/defaults', asyncHandler(async (req, res) => {
  const defaults = await cashFlowService.getDefaults();
  res.json(defaults);
}));

// POST /api/cash-flow-defaults
router.post('/defaults', asyncHandler(async (req, res) => {
  const defaults = await cashFlowService.saveDefaults(req.body);
  res.json(defaults);
}));

module.exports = router;
```

### 2. Service Layer
**File**: `services/cashFlow.service.js`

```javascript
const cashFlowRepository = require('../repositories/cashFlow.repository');
const { ValidationError } = require('../utils/errors');

class CashFlowService {
  async getCashFlow() {
    const data = await cashFlowRepository.read();
    
    // Business logic: ensure all months have loanPayment
    if (data && data.months) {
      data.months = data.months.map(m => ({
        loanPayment: 0,
        ...m
      }));
    }
    
    return data;
  }

  async saveCashFlow(data) {
    // Business logic: validate structure
    if (!data.months || !Array.isArray(data.months)) {
      throw new ValidationError('Invalid cash flow data structure');
    }

    await cashFlowRepository.write(data);
    return { success: true };
  }

  async getDefaults() {
    return await cashFlowRepository.readDefaults();
  }

  async saveDefaults(data) {
    // Business logic: normalize and validate
    const normalized = this.normalizeDefaults(data);
    await cashFlowRepository.writeDefaults(normalized);
    return normalized;
  }

  normalizeDefaults(data) {
    return {
      income: Number(data.income) || 0,
      mortgagePayment: Number(data.mortgagePayment) || 0,
      loanPayment: Number(data.loanPayment) || 0,
      additionalIncomes: (data.additionalIncomes || []).map(e => ({
        description: e.description ?? '',
        amount: Number(e.amount) || 0
      })),
      regularExpenses: (data.regularExpenses || []).map(e => ({
        description: e.description ?? '',
        amount: Number(e.amount) || 0,
        ...(e.category && { category: e.category })
      })),
      specialExpenses: (data.specialExpenses || []).map(e => ({
        description: e.description ?? '',
        amount: Number(e.amount) || 0,
        ...(e.category && { category: e.category })
      }))
    };
  }
}

module.exports = new CashFlowService();
```

### 3. Repository Layer
**File**: `repositories/cashFlow.repository.js`

```javascript
const fileStorage = require('../utils/fileStorage');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/cash-flow-data.json');
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
```

### 4. Utility - File Storage
**File**: `utils/fileStorage.js`

```javascript
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class FileStorage {
  /**
   * Read JSON file
   * @param {string} filePath - Path to file
   * @param {any} defaultValue - Default value if file doesn't exist
   * @returns {Promise<any>}
   */
  async readJSON(filePath, defaultValue = null) {
    try {
      const exists = await this.fileExists(filePath);
      if (!exists) {
        logger.info(`File not found: ${filePath}, returning default value`);
        return defaultValue;
      }

      const data = await fs.readFile(filePath, { encoding: 'utf8' });
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Error reading file ${filePath}:`, error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Write JSON file
   * @param {string} filePath - Path to file
   * @param {any} data - Data to write
   * @returns {Promise<void>}
   */
  async writeJSON(filePath, data) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(
        filePath,
        JSON.stringify(data, null, 2),
        { encoding: 'utf8' }
      );
      
      logger.info(`File written successfully: ${filePath}`);
    } catch (error) {
      logger.error(`Error writing file ${filePath}:`, error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file
   * @param {string} filePath
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info(`File deleted: ${filePath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error deleting file ${filePath}:`, error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }
    }
  }
}

module.exports = new FileStorage();
```

### 5. Error Handling
**File**: `utils/errors.js`

```javascript
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class InternalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InternalError';
    this.statusCode = 500;
  }
}

module.exports = {
  ValidationError,
  NotFoundError,
  InternalError
};
```

**File**: `middleware/errorMiddleware.js`

```javascript
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      name: err.name,
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
}

module.exports = errorHandler;
```

### 6. Async Handler
**File**: `utils/asyncHandler.js`

```javascript
/**
 * Wrapper for async route handlers
 * Catches errors and passes them to error middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
```

### 7. Logger
**File**: `utils/logger.js`

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
```

### 8. Updated index.js
**File**: `index.js`

```javascript
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
```

---

## 📦 צעדי ביצוע

### שלב 1: הכנה
```bash
# צור תיקיות
mkdir -p server/routes
mkdir -p server/services
mkdir -p server/repositories
mkdir -p server/utils
mkdir -p server/middleware
mkdir -p server/models
mkdir -p server/config

# הזז את כל קבצי ה-JSON
mv server/*.json server/data/
```

### שלב 2: Utils & Middleware
1. ✅ צור `utils/fileStorage.js`
2. ✅ צור `utils/logger.js`
3. ✅ צור `utils/errors.js`
4. ✅ צור `utils/asyncHandler.js`
5. ✅ צור `middleware/errorMiddleware.js`

### שלב 3: Repositories
1. ✅ צור `repositories/cashFlow.repository.js`
2. ✅ צור `repositories/installments.repository.js`
3. ✅ צור `repositories/investments.repository.js`
4. ✅ צור `repositories/conversations.repository.js`
5. ✅ צור `repositories/aiReports.repository.js`

### שלב 4: Services
1. ✅ צור `services/cashFlow.service.js`
2. ✅ צור `services/installments.service.js`
3. ✅ צור `services/investments.service.js`
4. ✅ צור `services/conversations.service.js`
5. ✅ צור `services/aiReports.service.js`
6. 🔄 `ai.service.js` - נשאר legacy (לא שונה)

### שלב 5: Routes
1. ✅ צור `routes/cashFlow.routes.js`
2. ✅ צור `routes/installments.routes.js`
3. ✅ צור `routes/investments.routes.js`
4. ✅ צור `routes/conversations.routes.js`
5. ✅ צור `routes/aiReports.routes.js`
6. ✅ צור `routes/index.js` (aggregator)
7. 🔄 `ai.routes.js` - נשאר legacy (לא שונה)

### שלב 6: Main & Data Migration
1. ✅ העתק `index.js` → `index.old.js`
2. ✅ העתק `index.new.js` → `index.js`
3. ✅ הזז כל קבצי JSON לתיקיית `data/`
4. ✅ הסרבר רץ ועובד!

### שלב 7: Testing
1. ✅ בדוק cash-flow endpoints
2. ✅ בדוק installments endpoints
3. ✅ בדוק investments endpoints
4. ✅ בדוק conversations endpoints
5. ✅ בדוק ai-reports endpoints
6. 🔄 בדוק AI endpoints (legacy)
7. ✅ בדוק error handling
8. ✅ בדוק logging

---

## 🎯 יתרונות

### לפני:
- ❌ 800+ שורות בקבצים בודדים
- ❌ קוד משוכפל
- ❌ קשה להוסיף features
- ❌ קשה לבדוק

### אחרי:
- ✅ קבצים קטנים (~100-200 שורות)
- ✅ אחריות ברורה לכל שכבה
- ✅ קל להוסיף features
- ✅ קל לבדוק (unit tests)
- ✅ Error handling מקצועי
- ✅ Logging מובנה
- ✅ מוכן למעבר ל-DB

---

## 📚 Dependencies חדשות

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0"
  }
}
```

---

**נוצר ב**: 8 יולי 2026  
**מטרה**: ארכיטקטורה נקייה ו-maintainable


---

## ✅ סטטוס ביצוע - הושלם!

**תאריך השלמה**: 8 יולי 2026

### מה הושלם:
- ✅ כל הקבצים נוצרו (utils, middleware, repositories, services, routes)
- ✅ קבצי JSON הועברו לתיקיית data/
- ✅ index.js עודכן והסרבר רץ
- ✅ כל ה-endpoints נבדקו ועובדים
- ✅ הנתונים נטענים כראוי (62 חודשים מ-cash-flow-data-miluim.json)
- ✅ Error handling + logging פעילים

### תוצאות בדיקות:
```
✓ Health: OK
✓ Cash Flow: 62 months loaded
✓ Defaults: Income=18,300
✓ Installments: 3 items
✓ Investments: 3 items
✓ Conversations: 1 item
✓ AI Reports: 1 item
```

**ראה תיעוד מלא ב-**: `REFACTORING_COMPLETE.md`

---

**🎉 הרפקטורינג הושלם בהצלחה! הסרבר רץ ועובד מצוין!**
