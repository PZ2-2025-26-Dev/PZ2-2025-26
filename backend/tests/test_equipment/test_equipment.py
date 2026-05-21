import pytest


def test_create_category_success(client):
    """Test poprawnego tworzenia kategorii głównej."""
    response = client.post(
        "/equipment/categories",
        json={"name": "IT Equipment", "parent_id": None}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "IT Equipment"
    assert data["parent_id"] is None
    assert "id" in data


def test_create_category_max_depth_exceeded(client):
    """Test walidacji maksymalnego zagnieżdżenia kategorii (maksymalnie 3 poziomy)."""
    # Poziom 1
    r1 = client.post("/equipment/categories", json={"name": "L1", "parent_id": None})
    l1_id = r1.json()["id"]

    # Poziom 2
    r2 = client.post("/equipment/categories", json={"name": "L2", "parent_id": l1_id})
    l2_id = r2.json()["id"]

    # Poziom 3
    r3 = client.post("/equipment/categories", json={"name": "L3", "parent_id": l2_id})
    l3_id = r3.json()["id"]

    # Próba utworzenia poziomu 4 - powinna zwrócić błąd 400
    response = client.post("/equipment/categories", json={"name": "L4", "parent_id": l3_id})
    assert response.status_code == 400
    assert response.json()["detail"] == "Maximum category depth (3) exceeded"


def test_create_category_parent_not_found(client):
    """Test próby utworzenia podkategorii dla nieistniejącego rodzica."""
    response = client.post("/equipment/categories", json={"name": "Laptops", "parent_id": 999})
    assert response.status_code == 404
    assert response.json()["detail"] == "Parent category not found"


def test_register_equipment_success(client):
    """Test poprawnej rejestracji sprzętu wraz z automatycznym wpisem do historii."""
    # Najpierw musimy stworzyć kategorię, aby klucz obcy był poprawny
    cat_res = client.post("/equipment/categories", json={"name": "Laptops", "parent_id": None})
    category_id = cat_res.json()["id"]

    equipment_data = {
        "name": "MacBook Pro 16",
        "type": "Laptop",
        "serial_number": "XYZ123456",
        "category_id": category_id,
        "owner_id": 1,
        "manager_id": 1,
        "room_id": 101,  # Przekazujemy wymagane pole lokalizacji
        "description": "Initial corporate laptop description"
    }

    response = client.post("/equipment/", json=equipment_data)
    assert response.status_code == 200
    data = response.json()
    assert data["serial_number"] == "XYZ123456"
    assert data["id"] is not None

    # Weryfikujemy, czy historia opisu została zainicjalizowana
    history_res = client.get(f"/equipment/{data['id']}/description-history")
    assert history_res.status_code == 200
    history_data = history_res.json()
    assert len(history_data) == 1
    assert history_data[0]["description"] == "Initial corporate laptop description"


def test_register_equipment_duplicate_serial_number(client):
    """Test unikalności numeru seryjnego sprzętu."""
    cat_res = client.post("/equipment/categories", json={"name": "Laptops", "parent_id": None})
    category_id = cat_res.json()["id"]

    equipment_data = {
        "name": "MacBook Pro 16",
        "type": "Laptop",
        "serial_number": "DUPLICATE123",
        "category_id": category_id,
        "owner_id": 1,
        "manager_id": 1,
        "room_id": 101,
        "description": "First item"
    }

    # Pierwsza rejestracja - sukces
    res1 = client.post("/equipment/", json=equipment_data)
    assert res1.status_code == 200

    # Druga rejestracja z tym samym numerem seryjnym - błąd 400
    res2 = client.post("/equipment/", json=equipment_data)
    assert res2.status_code == 400
    assert res2.json()["detail"] == "Serial number already exists"


def test_update_equipment_description_success(client):
    """Test aktualizacji opisu sprzętu oraz dopisywania kolejnego rekordu do historii."""
    cat_res = client.post("/equipment/categories", json={"name": "Laptops", "parent_id": None})
    category_id = cat_res.json()["id"]

    # Tworzenie sprzętu
    eq_res = client.post("/equipment/", json={
        "name": "Dell XPS", "type": "Laptop", "serial_number": "DELL555",
        "category_id": category_id, "owner_id": 1, "manager_id": 1, "room_id": 102,
        "description": "Old Description"
    })
    eq_id = eq_res.json()["id"]

    # Aktualizacja opisu przez PATCH
    patch_res = client.patch(f"/equipment/{eq_id}/description", json={"description": "New Description"})
    assert patch_res.status_code == 200
    assert patch_res.json()["description"] == "New Description"

    # Sprawdzenie historii zmian - powinny być teraz 2 wpisy, najnowszy na początku (desc)
    history_res = client.get(f"/equipment/{eq_id}/description-history")
    history_data = history_res.json()
    assert len(history_data) == 2
    assert history_data[0]["description"] == "New Description"
    assert history_data[1]["description"] == "Old Description"


def test_get_description_history_not_found(client):
    """Test próby pobrania historii dla nieistniejącego identyfikatora sprzętu."""
    response = client.get("/equipment/9999/description-history")
    assert response.status_code == 404
    assert response.json()["detail"] == "Equipment not found"
