"""Populate example workshop parts. Safe to run repeatedly (SKUs are unique)."""

import asyncio

import aiomysql

from app.config import Settings
from app.db import connect

# name, SKU, category, unit, quantity, reorder threshold
SAMPLE_ITEMS = [
    ("Hex bolts M8 x 30", "BLT-M8-030", "Fasteners", "pcs", 145, 40),
    ("Stainless washers M6", "WSH-M6-020", "Fasteners", "pcs", 82, 30),
    ("Wood screws 4 x 40", "SCR-4-040", "Fasteners", "pcs", 28, 60),
    ("Nylon cable ties", "CBL-TIE-100", "Electrical", "pcs", 240, 75),
    ("2.5 mm² electrical wire", "WIRE-2P5", "Electrical", "m", 64, 25),
    ("Terminal block 6-way", "TERM-6WAY", "Electrical", "pcs", 9, 15),
    ("Birch plywood 12 mm", "PLY-BIR-012", "Wood", "sheet", 17, 8),
    ("Pine timber 40 x 60", "TIM-PIN-4060", "Wood", "m", 52, 20),
    ("Wood glue PVA", "GLUE-PVA-1L", "Adhesives", "bottle", 6, 8),
    ("Epoxy adhesive 2K", "EPOXY-2K-50", "Adhesives", "tube", 16, 5),
    ("Safety glasses clear", "PPE-GLASS-C", "Safety", "pcs", 14, 10),
    ("Cut-resistant gloves", "PPE-GLOVE-L", "Safety", "pair", 7, 12),
]


async def main() -> None:
    pool = await connect(Settings.from_environment())
    inserted = 0
    try:
        async with pool.acquire() as conn:
            try:
                async with conn.cursor(aiomysql.DictCursor) as cur:
                    for name, sku, category, unit, quantity, reorder in SAMPLE_ITEMS:
                        await cur.execute(
                            "INSERT IGNORE INTO items "
                            "(name, sku, category, unit, quantity, reorder_level) "
                            "VALUES (%s, %s, %s, %s, %s, %s)",
                            (name, sku, category, unit, quantity, reorder),
                        )
                        if cur.rowcount:
                            inserted += 1
                            await cur.execute(
                                "INSERT INTO movements (item_id, item_name, delta, note) "
                                "VALUES (%s, %s, %s, %s)",
                                (cur.lastrowid, name, quantity, "Demo inventory setup"),
                            )
                await conn.commit()
            except Exception:
                await conn.rollback()
                raise
    finally:
        pool.close()
        await pool.wait_closed()
    print(f"Seed completed: {inserted} new items, {len(SAMPLE_ITEMS) - inserted} already existed")


if __name__ == "__main__":
    asyncio.run(main())
