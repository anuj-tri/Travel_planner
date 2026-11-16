import os

import redis
import valkey
from dotenv import load_dotenv
from valkey.credentials import CredentialProvider
from developer_toolkit_elasticache import ElastiCacheIAMAuthTokenProvider

load_dotenv()

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "production":
    # AWS-managed ElastiCache non-based Valkey
    VALKEY_HOST = os.getenv("VALKEY_HOST")
    VALKEY_PORT = int(os.getenv("VALKEY_PORT", "6379"))
    VALKEY_USERNAME = os.getenv("VALKEY_USERNAME")
    VALKEY_CACHE_NAME = os.getenv("VALKEY_CACHE_NAME")
    AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-2")

    required_settings = {
        "VALKEY_HOST": VALKEY_HOST,
        "VALKEY_USERNAME": VALKEY_USERNAME,
        "VALKEY_CACHE_NAME": VALKEY_CACHE_NAME,
    }

    missing_settings = [name for name, value in required_settings.items() if not value]

    if missing_settings:
        raise RuntimeError(
            "Missing production Valkey settings: " + ", ".join(missing_settings)
        )

    class ElastiCacheCredentialProvider(CredentialProvider):
        def __init__(self, auth):
            self._auth = auth

        def get_credentials(self):
            return self._auth.user_id, self._auth.get_token()

    auth = ElastiCacheIAMAuthTokenProvider(
        replication_group_id=VALKEY_CACHE_NAME,
        user_id=VALKEY_USERNAME,
        region=AWS_REGION,
    )

    redis_client = valkey.Valkey(
        host=VALKEY_HOST,
        port=VALKEY_PORT,
        ssl=True,
        credential_provider=ElastiCacheCredentialProvider(auth),
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )

else:
    REDIS_URL = os.getenv("REDIS_URL")

    if not REDIS_URL:
        raise RuntimeError("Redis is not configured in the .env file")

    redis_client = redis.Redis.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )


def close_redis_connection():
    redis_client.close()
