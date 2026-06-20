class LoanNotFoundError(Exception):
    """Wypożyczenie o podanym ID nie istnieje."""


class LoanItemNotFoundError(Exception):
    """Wskazany przedmiot nie istnieje."""


class LoanBorrowerNotFoundError(Exception):
    """Wskazany Gość (borrower) nie istnieje."""


class LoanBorrowerNotGuestError(Exception):
    """Wskazany użytkownik nie jest Gościem (rola GUEST)."""


class ItemNotAvailableError(Exception):
    """Przedmiot nie jest dostępny do wypożyczenia."""


class LoanAlreadyReturnedError(Exception):
    """Wypożyczenie zostało już zakończone (zwrócone)."""
