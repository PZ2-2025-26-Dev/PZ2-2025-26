class GuestNotFoundError(Exception):
    """Gość o podanym ID nie istnieje (lub nie jest Gościem)."""


class GuestEmailTakenError(Exception):
    """Podany adres email jest już używany przez innego użytkownika."""


class GuestHasLoanHistoryError(Exception):
    """Nie można usunąć Gościa, który posiada historię wypożyczeń."""
