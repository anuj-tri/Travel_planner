import os

import  redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv('REDIS_URL')

if not REDIS_URL : raise RuntimeError("Redis is not configured in the .env file")

redis_client = redis.Redis.from_url(
    REDIS_URL,
    decode_responses = True,
    socket_connect_timeout = 5,
    socket_timeout= 5,
)

def close_redis_connection():
    redis_client.close()

