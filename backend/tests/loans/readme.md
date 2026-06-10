# Guest Loan Tests

Tests verify `LoanService.create_external_loan` for guest borrowing.

## Covers

- success for item owner,
- success with ACL permission (`AUTO_APPROVED_LOAN`),
- forbidden without permission (`LoanForbiddenError`),
- conflict when item is unavailable (`LoanConflictError`),
- not found for missing item/guest (`LoanNotFoundError`),
- side effects on success: item status -> `LOANED`, history entry created.

## Run

```bash
cd backend
PZ_DATABASE_URL="sqlite:///dev.db" uv run python -m pytest tests/loans/test_loan_service.py