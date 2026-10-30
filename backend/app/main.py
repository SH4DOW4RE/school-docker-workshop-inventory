"""Starlette REST API for a small workshop inventory application."""

import logging
from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal
from typing import Any, TypeVar

import aiomysql
from pydantic import BaseModel, ValidationError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from .config import Settings
from .db import connect
from .schemas import ItemCreate, ItemUpdate, StockMovementCreate

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)
ITEM_COLUMNS = "id, name, sku, category, unit, quantity, reorder_level, created_at, updated_at"


def to_json(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: to_json(entry) for key, entry in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json(entry) for entry in value]
    return value


def respond(data: dict[str, Any], status_code: int = 200) -> JSONResponse:
    return JSONResponse(to_json(data), status_code=status_code)


async def validated_body(request: Request, schema: type[T]) -> T:
    try:
        payload = await request.json()
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(400, "Request body must be valid JSON") from exc
    try:
        return schema.model_validate(payload)
    except ValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(map(str, first["loc"])) or "body"
        raise HTTPException(422, f"{field}: {first['msg']}") from exc


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return respond({"error": exc.detail}, status_code=exc.status_code)


async def internal_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error", exc_info=exc)
    return respond({"error": "Internal server error"}, status_code=500)


@asynccontextmanager
async def lifespan(app: Starlette):
    settings = Settings.from_environment()
    app.state.pool = await connect(settings)
    try:
        yield
    finally:
        app.state.pool.close()
        await app.state.pool.wait_closed()


async def health(request: Request) -> JSONResponse:
    try:
        async with request.app.state.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1")
                await cur.fetchone()
    except aiomysql.Error as exc:
        logger.warning("Health check failed: %s", exc)
        return respond({"status": "degraded", "database": "unavailable"}, 503)
    return respond({"status": "ok", "database": "connected"})


async def list_items(request: Request) -> JSONResponse:
    search = request.query_params.get("search", "").strip()[:120]
    category = request.query_params.get("category", "").strip()[:64]
    filters: list[str] = []
    args: list[str] = []
    if search:
        filters.append("(name LIKE %s OR sku LIKE %s)")
        args.extend((f"%{search}%", f"%{search}%"))
    if category:
        filters.append("category = %s")
        args.append(category)
    where = " WHERE " + " AND ".join(filters) if filters else ""
    async with request.app.state.pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(f"SELECT {ITEM_COLUMNS} FROM items{where} ORDER BY name, id", args)
            items = await cur.fetchall()
    return respond({"items": items})


async def get_item(request: Request) -> JSONResponse:
    item_id = request.path_params["item_id"]
    async with request.app.state.pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(f"SELECT {ITEM_COLUMNS} FROM items WHERE id = %s", (item_id,))
            item = await cur.fetchone()
    if not item:
        raise HTTPException(404, "Item not found")
    return respond({"item": item})


async def create_item(request: Request) -> JSONResponse:
    data = await validated_body(request, ItemCreate)
    async with request.app.state.pool.acquire() as conn:
        try:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "INSERT INTO items (name, sku, category, unit, quantity, reorder_level) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (data.name, data.sku, data.category, data.unit, data.quantity, data.reorder_level),
                )
                item_id = cur.lastrowid
                if data.quantity:
                    await cur.execute(
                        "INSERT INTO movements (item_id, item_name, delta, note) VALUES (%s, %s, %s, %s)",
                        (item_id, data.name, data.quantity, "Initial stock"),
                    )
                await cur.execute(f"SELECT {ITEM_COLUMNS} FROM items WHERE id = %s", (item_id,))
                item = await cur.fetchone()
            await conn.commit()
        except aiomysql.IntegrityError as exc:
            await conn.rollback()
            if exc.args and exc.args[0] == 1062:
                raise HTTPException(409, "An item with this SKU already exists") from exc
            raise
        except Exception:
            await conn.rollback()
            raise
    return respond({"item": item}, 201)


async def update_item(request: Request) -> JSONResponse:
    item_id = request.path_params["item_id"]
    data = await validated_body(request, ItemUpdate)
    async with request.app.state.pool.acquire() as conn:
        try:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute("SELECT id FROM items WHERE id = %s FOR UPDATE", (item_id,))
                if not await cur.fetchone():
                    raise HTTPException(404, "Item not found")
                await cur.execute(
                    "UPDATE items SET name = %s, sku = %s, category = %s, unit = %s, reorder_level = %s "
                    "WHERE id = %s",
                    (data.name, data.sku, data.category, data.unit, data.reorder_level, item_id),
                )
                await cur.execute(f"SELECT {ITEM_COLUMNS} FROM items WHERE id = %s", (item_id,))
                item = await cur.fetchone()
            await conn.commit()
        except aiomysql.IntegrityError as exc:
            await conn.rollback()
            if exc.args and exc.args[0] == 1062:
                raise HTTPException(409, "An item with this SKU already exists") from exc
            raise
        except Exception:
            await conn.rollback()
            raise
    return respond({"item": item})


async def delete_item(request: Request) -> JSONResponse:
    item_id = request.path_params["item_id"]
    async with request.app.state.pool.acquire() as conn:
        try:
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM items WHERE id = %s", (item_id,))
                deleted = cur.rowcount
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise
    if deleted == 0:
        raise HTTPException(404, "Item not found")
    return respond({"message": "Item deleted; movement history retained"})


async def list_movements(request: Request) -> JSONResponse:
    limit = 40
    async with request.app.state.pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT id, item_id, item_name, delta, note, created_at "
                "FROM movements ORDER BY id DESC LIMIT %s",
                (limit,),
            )
            movements = await cur.fetchall()
    return respond({"movements": movements})


async def record_movement(request: Request) -> JSONResponse:
    data = await validated_body(request, StockMovementCreate)
    async with request.app.state.pool.acquire() as conn:
        try:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT id, name, quantity FROM items WHERE id = %s FOR UPDATE", (data.item_id,)
                )
                item = await cur.fetchone()
                if not item:
                    raise HTTPException(404, "Item not found")
                new_quantity = item["quantity"] + data.delta
                if new_quantity < 0:
                    raise HTTPException(409, "Not enough stock for this adjustment")
                if new_quantity > 1_000_000:
                    raise HTTPException(422, "Stock would exceed the maximum allowed quantity")
                await cur.execute("UPDATE items SET quantity = %s WHERE id = %s", (new_quantity, data.item_id))
                await cur.execute(
                    "INSERT INTO movements (item_id, item_name, delta, note) VALUES (%s, %s, %s, %s)",
                    (data.item_id, item["name"], data.delta, data.note),
                )
                movement_id = cur.lastrowid
                await cur.execute(
                    "SELECT id, item_id, item_name, delta, note, created_at "
                    "FROM movements WHERE id = %s",
                    (movement_id,),
                )
                movement = await cur.fetchone()
            await conn.commit()
        except Exception:
            await conn.rollback()
            raise
    return respond({"movement": movement, "new_quantity": new_quantity}, 201)


async def stats(request: Request) -> JSONResponse:
    async with request.app.state.pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT COUNT(*) AS total_items, COALESCE(SUM(quantity), 0) AS total_units, "
                "COALESCE(SUM(CASE WHEN quantity <= reorder_level THEN 1 ELSE 0 END), 0) "
                "AS low_stock_items FROM items"
            )
            totals = await cur.fetchone()
            await cur.execute(
                "SELECT category, COUNT(*) AS item_count, COALESCE(SUM(quantity), 0) AS units "
                "FROM items GROUP BY category ORDER BY item_count DESC, category ASC"
            )
            categories = await cur.fetchall()
    return respond({"stats": {**totals, "categories": categories}})


routes = [
    Route("/api/health", health, methods=["GET"]),
    Route("/api/items", list_items, methods=["GET"]),
    Route("/api/items", create_item, methods=["POST"]),
    Route("/api/items/{item_id:int}", get_item, methods=["GET"]),
    Route("/api/items/{item_id:int}", update_item, methods=["PUT"]),
    Route("/api/items/{item_id:int}", delete_item, methods=["DELETE"]),
    Route("/api/movements", list_movements, methods=["GET"]),
    Route("/api/movements", record_movement, methods=["POST"]),
    Route("/api/stats", stats, methods=["GET"]),
]

app = Starlette(
    routes=routes,
    lifespan=lifespan,
    exception_handlers={HTTPException: http_exception_handler, Exception: internal_exception_handler},
)
