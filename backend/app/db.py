from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine


def _default_db_path() -> Path:
    # Keep all runtime artifacts under logs/ (fits audit mindset)
    root = Path(__file__).resolve().parents[2]
    logs_dir = root / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    return logs_dir / "fraudshield.db"


DB_PATH = Path(os.environ.get("FRAUDSHIELD_DB_PATH", str(_default_db_path())))
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

