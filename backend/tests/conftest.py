import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.library import Library
from app.models.user import ROLE_MEMBER, ROLE_OWNER, User

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

    # Create default test user with their own library
    test_library = Library(name="Test User", is_public_shelf=True)
    session.add(test_library)
    session.flush()
    test_user = User(
        email="test@example.com",
        password_hash=hash_password("password123"),
        display_name="Test User",
        library_id=test_library.id,
        role=ROLE_OWNER,
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
    library = Library(name="User Two", share_slug="usertwo", is_public_shelf=True)
    db_session.add(library)
    db_session.flush()
    user = User(
        email="user2@example.com",
        password_hash=hash_password("password123"),
        display_name="User Two",
        library_id=library.id,
        role=ROLE_OWNER,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers_user2(second_user: User) -> dict[str, str]:
    token = create_access_token(subject=second_user.email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def member_user(db_session: Session) -> User:
    """A second account inside the default test user's library."""
    test_user = db_session.query(User).filter(User.email == "test@example.com").first()
    user = User(
        email="member@example.com",
        password_hash=hash_password("password123"),
        display_name="Member User",
        library_id=test_user.library_id,
        role=ROLE_MEMBER,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers_member(member_user: User) -> dict[str, str]:
    token = create_access_token(subject=member_user.email)
    return {"Authorization": f"Bearer {token}"}
