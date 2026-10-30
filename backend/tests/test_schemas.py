"""Pure validation tests; these do not need a running MySQL database."""

import pytest
from pydantic import ValidationError

from app.schemas import ItemCreate, StockMovementCreate


def test_sku_is_normalized():
    item = ItemCreate(name="M4 bolts", sku="  blt-m4  ", category="Fasteners", unit="pcs", quantity=20, reorder_level=5)
    assert item.sku == "BLT-M4"


def test_negative_initial_quantity_rejected():
    with pytest.raises(ValidationError):
        ItemCreate(name="M4 bolts", sku="BLT-M4", category="Fasteners", unit="pcs", quantity=-1, reorder_level=5)


def test_zero_movement_rejected():
    with pytest.raises(ValidationError):
        StockMovementCreate(item_id=1, delta=0)
