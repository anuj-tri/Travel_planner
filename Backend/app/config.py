import os
from pathlib import Path
#local devlopment RSA key directory

KEYS_DIRECTORY = (
    Path.home() / "AppData" / "Local" / "SmartTravelPlanner" / "secrets"
)

#RSA key file paths
RSA_PRIVATE_KEY_PATH = Path(
    os.getenv("RSA_PRIVATE_KEY_PATH" , str(KEYS_DIRECTORY / "rsa_private_key.pem"))
)

RSA_PUBLIC_KEY_PATH = Path(
    os.getenv("RSA_PUBLIC_KEY_PATH", str(KEYS_DIRECTORY / "rsa_public_key.pem"))
)
