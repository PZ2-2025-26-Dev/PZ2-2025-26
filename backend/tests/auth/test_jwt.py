
from src.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)


def test_create_access_token():
    token = create_access_token(1)

    payload = decode_token(token)

    assert payload["sub"] == "1"
    assert payload["type"] == "access"


def test_create_refresh_token():
    token = create_refresh_token(1)

    payload = decode_token(token)

    assert payload["sub"] == "1"
    assert payload["type"] == "refresh"


def test_decode_token():
    token = create_access_token(123)

    payload = decode_token(token)

    assert payload["sub"] == "123"


def test_decode_invalid_token():
    import pytest

    with pytest.raises(ValueError):
        decode_token("invalid-token")