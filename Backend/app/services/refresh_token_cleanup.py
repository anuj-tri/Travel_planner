
from datetime import datetime, timezone

from sqlalchemy import delete

from app.database import session
from app.models import RefreshToken


def cleanup_expired_refresh_tokens():
    """Delete refresh-token records that have expired."""
    db = session()

    try:
        current_time = datetime.now(timezone.utc)

        statement = delete(RefreshToken).where(
            RefreshToken.expire_at <= current_time
        )

        result = db.execute(statement)
        deleted_count = result.rowcount or 0

        db.commit()

        print(
            f"Refresh token cleanup completed. "
            f"Deleted {deleted_count} expired token(s)."
        )

    except Exception as error:
        db.rollback()
        print(f"Refresh token cleanup failed: {error}")

    finally:
        db.close()
