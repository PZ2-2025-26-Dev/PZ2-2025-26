# workaround:
# dopóki nie mamy innych testów jednostkowych
# potrzebujemy jakiś prosty test, który nie jest oznaczony "integration"
# żeby `make pipeline` działało poprawnie
# Jak dodamy inne testy jednostkowe to możemy ten usunąć


def test_add():
    assert 2 + 2 == 4
