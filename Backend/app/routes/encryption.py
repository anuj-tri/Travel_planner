from fastapi import APIRouter, HTTPException, status

from app.config import RSA_PUBLIC_KEY_PATH

router = APIRouter()


@router.get("/public-key")
def get_public_key():
    try:
        public_key = RSA_PUBLIC_KEY_PATH.read_text(encoding="utf-8")

        return {"public_key": public_key}

    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Encryption public key is unavailable",
        )
