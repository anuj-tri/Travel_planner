import os

import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

REDIS_OPTIONS = {
    "decode_responses": True,
    "socket_connect_timeout": 5,
    "socket_timeout": 5,
}

if REDIS_URL:
    # Local Docker Compose
    redis_client = redis.Redis.from_url(
        REDIS_URL,
        **REDIS_OPTIONS,
    )

elif REDIS_PASSWORD:
    # Production Docker Compose
    redis_client = redis.Redis(
        host=os.getenv("REDIS_HOST", "redis"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=0,
        password=REDIS_PASSWORD,
        **REDIS_OPTIONS,
    )

else:
    raise RuntimeError(
        "Redis is not configured. Set REDIS_URL or REDIS_PASSWORD."
    )


def close_redis_connection():
    redis_client.close()
