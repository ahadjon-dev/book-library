"""Create the household accounts. Run once after migrations.

Usage:
    python -m scripts.seed_users you@example.com "Your Name" wife@example.com "Her Name"

Passwords are prompted interactively so they never end up in shell history.
"""
import getpass
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def create_user(db, email: str, display_name: str) -> None:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"skip: {email} already exists")
        return

    password = getpass.getpass(f"Password for {email}: ")
    confirm = getpass.getpass("Confirm: ")
    if password != confirm:
        print(f"error: passwords did not match for {email}, skipping")
        return

    user = User(email=email, display_name=display_name, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    print(f"created: {email}")


def main() -> None:
    args = sys.argv[1:]
    if len(args) % 2 != 0 or not args:
        print(__doc__)
        sys.exit(1)

    db = SessionLocal()
    try:
        for i in range(0, len(args), 2):
            create_user(db, email=args[i], display_name=args[i + 1])
    finally:
        db.close()


if __name__ == "__main__":
    main()
