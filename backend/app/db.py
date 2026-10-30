"""MySQL pool and lightweight schema initialization."""

import asyncio
import logging

import aiomysql

from .config import Settings

logger = logging.getLogger(__name__)


CREATE_ITEMS = """
CREATE TABLE IF NOT EXISTS items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    sku VARCHAR(48) NOT NULL UNIQUE,
    category VARCHAR(64) NOT NULL,
    unit VARCHAR(16) NOT NULL DEFAULT 'pcs',
    quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_items_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

CREATE_MOVEMENTS = """
CREATE TABLE IF NOT EXISTS movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    item_id BIGINT UNSIGNED NULL,
    item_name VARCHAR(120) NOT NULL,
    delta INT NOT NULL,
    note VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_movements_created_at (created_at),
    CONSTRAINT fk_movements_item FOREIGN KEY (item_id)
        REFERENCES items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


async def connect(settings: Settings) -> aiomysql.Pool:
    """Retry connections briefly to tolerate a database starting separately."""
    last_error: Exception | None = None
    for attempt in range(1, 16):
        try:
            pool = await aiomysql.create_pool(
                host=settings.db_host,
                port=settings.db_port,
                user=settings.db_user,
                password=settings.db_pass,
                db=settings.db_name,
                charset="utf8mb4",
                autocommit=False,
                minsize=1,
                maxsize=10,
                connect_timeout=5,
            )
            try:
                async with pool.acquire() as conn:
                    async with conn.cursor() as cur:
                        await cur.execute(CREATE_ITEMS)
                        await cur.execute(CREATE_MOVEMENTS)
                    await conn.commit()
            except Exception:
                pool.close()
                await pool.wait_closed()
                raise
            logger.info("Connected to MySQL and checked application tables")
            return pool
        except (OSError, aiomysql.Error) as exc:
            last_error = exc
            logger.warning("MySQL connection attempt %s/15 failed: %s", attempt, exc)
            if attempt != 15:
                await asyncio.sleep(2)
    raise RuntimeError("Could not connect to the configured MySQL database") from last_error
