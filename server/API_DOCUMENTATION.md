# 📚 API Documentation - Cash Flow Server

## Base URL
```
http://localhost:3000/api
```

---

## 🏥 Health Check

### GET `/health`
בדיקת תקינות השרת

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-07-08T19:00:00.000Z",
  "uptime": 123.456
}
```

---

## 💰 Cash Flow Endpoints

### GET `/cash-flow`
קבלת נתוני תזרים מזומנים

**Response:**
```json
{
  "months": [
    {
      "month": "2026-07-01T00:00:00.000Z",
      "startingBalance": 10000,
      "income": 15000,
      "mortgagePayment": 5000,
      "loanPayment": 2000,
      "installmentsPayment": 500,
      "regularExpenses": [...],
      "specialExpenses": [...],
      "additionalIncomes": [...],
      "endingBalance": 17500,
      "rowColor": "#dcfce7"
    }
  ]
}
```

---

### POST `/cash-flow`
שמירת נתוני תזרים מזומנים

**Request Body:**
```json
{
  "months": [...]
}
```

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `400 Bad Request` - Invalid data structure

---

### GET `/cash-flow-defaults`
קבלת ברירות מחדל

**Response:**
```json
{
  "income": 15000,
  "mortgagePayment": 5000,
  "loanPayment": 2000,
  "additionalIncomes": [
    {
      "description": "עבודה נוספת",
      "amount": 3000
    }
  ],
  "regularExpenses": [
    {
      "description": "ארנונה",
      "amount": 500,
      "category": "housing"
    }
  ],
  "specialExpenses": []
}
```

---

### POST `/cash-flow-defaults`
שמירת ברירות מחדל

**Request Body:**
```json
{
  "income": 15000,
  "mortgagePayment": 5000,
  "loanPayment": 2000,
  "additionalIncomes": [...],
  "regularExpenses": [...],
  "specialExpenses": [...]
}
```

**Response:**
```json
{
  "income": 15000,
  "mortgagePayment": 5000,
  ...
}
```

---

## 📊 Installments Endpoints

### GET `/installments`
קבלת כל הפריסות

**Response:**
```json
[
  {
    "id": "1234567890",
    "name": "מזגן",
    "totalAmount": 5000,
    "downPayment": 500,
    "monthlyPayment": 450,
    "installmentsCount": 10,
    "startDate": "2026-07-01",
    "color": "#4f6ef7",
    "notes": "פריסה ללא ריבית",
    "manualPaidCount": 2,
    "paymentType": "manual",
    "loanComponents": [],
    "milestones": [],
    "milestonePayments": [],
    "payments": []
  }
]
```

---

### GET `/installments/:id`
קבלת פריסה לפי ID

**Parameters:**
- `id` (string) - מזהה הפריסה

**Response:**
```json
{
  "id": "1234567890",
  "name": "מזגן",
  ...
}
```

**Errors:**
- `404 Not Found` - Installment not found

---

### POST `/installments`
יצירת פריסה חדשה

**Request Body:**
```json
{
  "name": "מזגן",
  "totalAmount": 5000,
  "downPayment": 500,
  "monthlyPayment": 450,
  "installmentsCount": 10,
  "startDate": "2026-07-01",
  "color": "#4f6ef7",
  "notes": "פריסה ללא ריבית",
  "paymentType": "manual"
}
```

**Response:** `201 Created`
```json
{
  "id": "1234567890",
  "name": "מזגן",
  ...
}
```

**Errors:**
- `400 Bad Request` - Validation error (name is required)

---

### PUT `/installments/:id`
עדכון פריסה

**Parameters:**
- `id` (string) - מזהה הפריסה

**Request Body:** (כל השדות אופציונליים)
```json
{
  "name": "מזגן חדש",
  "monthlyPayment": 500,
  "manualPaidCount": 3
}
```

**Response:**
```json
{
  "id": "1234567890",
  "name": "מזגן חדש",
  ...
}
```

**Errors:**
- `404 Not Found` - Installment not found

---

### DELETE `/installments/:id`
מחיקת פריסה

**Parameters:**
- `id` (string) - מזהה הפריסה

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `404 Not Found` - Installment not found

---

## 💼 Investments Endpoints

### GET `/investments`
קבלת כל ההשקעות

**Response:**
```json
[
  {
    "id": "9876543210",
    "name": "קרן השתלמות",
    "initialAmount": 50000,
    "currentAmount": 55000,
    "currency": "ILS",
    "type": "savings",
    "startDate": "2020-01-01",
    "notes": ""
  }
]
```

---

### GET `/investments/:id`
קבלת השקעה לפי ID

**Response:**
```json
{
  "id": "9876543210",
  "name": "קרן השתלמות",
  ...
}
```

**Errors:**
- `404 Not Found` - Investment not found

---

### POST `/investments`
יצירת השקעה חדשה

**Request Body:**
```json
{
  "name": "קרן השתלמות",
  "initialAmount": 50000,
  "currentAmount": 55000,
  "currency": "ILS",
  "type": "savings",
  "startDate": "2020-01-01",
  "notes": ""
}
```

**Response:** `201 Created`
```json
{
  "id": "9876543210",
  "name": "קרן השתלמות",
  ...
}
```

**Errors:**
- `400 Bad Request` - Validation error (name is required)

---

### PUT `/investments/:id`
עדכון השקעה

**Request Body:** (כל השדות אופציונליים)
```json
{
  "currentAmount": 60000,
  "notes": "רווח של 10,000 ₪"
}
```

**Response:**
```json
{
  "id": "9876543210",
  "currentAmount": 60000,
  ...
}
```

**Errors:**
- `404 Not Found` - Investment not found

---

### DELETE `/investments/:id`
מחיקת השקעה

**Response:**
```json
{
  "success": true
}
```

**Errors:**
- `404 Not Found` - Investment not found

---

## 🤖 AI Endpoints

### (Existing - not refactored yet)
- `/ai/*` - AI related endpoints
- `/conversations/*` - Conversations endpoints
- `/ai-reports/*` - AI Reports endpoints

---

## ❌ Error Responses

כל ה-endpoints יכולים להחזיר errors בפורמט הבא:

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "name": "ValidationError",
    "message": "Name is required"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "name": "NotFoundError",
    "message": "Installment with id 123 not found"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "name": "InternalError",
    "message": "Failed to read file: ..."
  }
}
```

**Development Mode:**
בסביבת development, errors כוללים גם `stack` trace:
```json
{
  "success": false,
  "error": {
    "name": "ValidationError",
    "message": "Name is required",
    "stack": "Error: Name is required\n    at ..."
  }
}
```

---

## 📝 Examples with cURL

### Get Cash Flow
```bash
curl http://localhost:3000/api/cash-flow
```

### Save Cash Flow
```bash
curl -X POST http://localhost:3000/api/cash-flow \
  -H "Content-Type: application/json" \
  -d '{"months":[...]}'
```

### Get Installments
```bash
curl http://localhost:3000/api/installments
```

### Create Installment
```bash
curl -X POST http://localhost:3000/api/installments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "מזגן",
    "totalAmount": 5000,
    "monthlyPayment": 450,
    "installmentsCount": 10,
    "startDate": "2026-07-01"
  }'
```

### Update Installment
```bash
curl -X PUT http://localhost:3000/api/installments/1234567890 \
  -H "Content-Type: application/json" \
  -d '{"manualPaidCount": 3}'
```

### Delete Installment
```bash
curl -X DELETE http://localhost:3000/api/installments/1234567890
```

---

## 🔧 Development

### Enable Debug Logging
```bash
NODE_ENV=development npm start
```

### Test Error Handling
```bash
# Test validation error
curl -X POST http://localhost:3000/api/installments \
  -H "Content-Type: application/json" \
  -d '{}'

# Test 404
curl http://localhost:3000/api/installments/notfound
```

---

**Generated**: July 8, 2026  
**Version**: 2.0 (Refactored)
