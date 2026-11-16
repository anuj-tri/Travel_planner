import base64
from  functools import lru_cache

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.config import RSA_PRIVATE_KEY_PATH

class InvalidCiphertextError(Exception):
    """Raised when encrypted password cannot be decrypted"""
    pass


# Load the private key only once and reuse it for subsequent requests
@lru_cache(maxsize=1)
def get_private_key():
    #load the private key from the pem file
    private_key_data = RSA_PRIVATE_KEY_PATH.read_bytes()

    private_key = serialization.load_pem_private_key(
        private_key_data,
        password=None
    )

    if not isinstance(private_key, rsa.RSAPrivateKey):
        raise RuntimeError("Configured key is not an RSA private key")

    return private_key

def decrypt_password(encrypted_password: str) -> str:
    try:
        #decode the base 64 encrypted password
        encrypted_bytes = base64.b64decode(
            encrypted_password,
            validate=True
        )

        #Load the rsa private key
        private_key = get_private_key()

        #decrypt using RSA-OAEP with SHA-256
        decrypted_bytes = private_key.decrypt(
            encrypted_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm =hashes.SHA256(),
                label=None
            )
        )

        #convert decrypted bytes into a string
        return decrypted_bytes.decode("utf-8")

    except(
        ValueError,
        TypeError,
        base64.binascii.Error,
        UnicodeDecodeError
    ) as error:
        raise InvalidCiphertextError(
            "Invalid or undecrytable password"
        ) from error
