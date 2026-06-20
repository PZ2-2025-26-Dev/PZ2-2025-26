from enum import Enum

LOAN_PURPOSE_MAX_LENGTH = 512

# Domyślne i maksymalne rozmiary stron listy wypożyczeń.
DEFAULT_LOAN_PAGE_SIZE = 20
MAX_LOAN_PAGE_SIZE = 100


class LoanStatus(Enum):
    # Wypożyczenie aktywne – sprzęt jest u Gościa.
    ACTIVE = "active"
    # Sprzęt został zwrócony – wpis pozostaje w historii.
    RETURNED = "returned"
