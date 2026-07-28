from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def ensure_schema_compatibility() -> None:
    """Apply the two additive metric columns required by the AI model."""
    inspector = inspect(engine)
    if "metrics" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("metrics")}
    statements = []
    if "traffic_in_mbps" not in existing:
        statements.append("ALTER TABLE metrics ADD COLUMN traffic_in_mbps FLOAT")
    if "traffic_out_mbps" not in existing:
        statements.append("ALTER TABLE metrics ADD COLUMN traffic_out_mbps FLOAT")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
