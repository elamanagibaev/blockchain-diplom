from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def run():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "admin@example.com").first()
        if existing:
            print("Admin user already exists:", existing.email)
            return

        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            role="admin",
        )
        db.add(admin)
        db.commit()
        print("Created admin user: admin@example.com / admin")
    finally:
        db.close()


if __name__ == "__main__":
    run()
