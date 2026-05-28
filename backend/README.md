## FraudShield Analytics Backend (FastAPI)

### Run (Windows PowerShell)

```powershell
cd c:\HASFI\Projects\fraud-audit-system
pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

### Notes
- Upload endpoint: `POST /api/upload` (multipart `file`)
- Swagger: `GET /docs`

