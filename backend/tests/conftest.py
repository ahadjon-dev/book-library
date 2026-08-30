import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User

# In-memory SQLite for ultra-fast, isolated testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    # Create default test user
    test_user = User(
        email="test@example.com",
        password_hash=hash_password("password123"),
        display_name="Test User",
    )
    session.add(test_user)
    session.commit()
    session.refresh(test_user)

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_headers(db_session: Session) -> dict[str, str]:
    token = create_access_token(subject="test@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def second_user(db_session: Session) -> User:
    user = User(
        email="user2@example.com",
        password_hash=hash_password("password123"),
        display_name="User Two",
        share_slug="usertwo",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers_user2(second_user: User) -> dict[str, str]:
    token = create_access_token(subject=second_user.email)
    return {"Authorization": f"Bearer {token}"}
