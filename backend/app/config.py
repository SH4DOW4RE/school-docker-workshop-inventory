"""Environment-based configuration; no database credentials are hardcoded."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_pass: str

    @classmethod
    def from_environment(cls) -> "Settings":
        required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS")
        missing = [name for name in required if not os.getenv(name)]
        if missing:
            raise RuntimeError("Missing required environment variables: " + ", ".join(missing))
        try:
            port = int(os.environ["DB_PORT"])
        except ValueError as exc:
            raise RuntimeError("DB_PORT must be a valid integer") from exc
        if not 1 <= port <= 65535:
            raise RuntimeError("DB_PORT must be between 1 and 65535")
        return cls(
            db_host=os.environ["DB_HOST"],
            db_port=port,
            db_name=os.environ["DB_NAME"],
            db_user=os.environ["DB_USER"],
            db_pass=os.environ["DB_PASS"],
        )
