
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization


# Local development RSA key directory
secrets_folder = (
    Path.home() / "AppData" / "Local" / "SmartTravelPlanner" / "secrets"
)

private_key_path = secrets_folder / "rsa_private_key.pem"
public_key_path = secrets_folder / "rsa_public_key.pem"


# Create the secrets directory if it does not exist
secrets_folder.mkdir(parents=True, exist_ok=True)


# Prevent accidental overwriting of an existing key pair
if private_key_path.exists() or public_key_path.exists():
    raise SystemExit(
        "RSA key file(s) already exist. "
        "Generation stopped to prevent overwriting existing keys.\n"
        f"Directory: {secrets_folder}"
    )


# Generate RSA private key
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=3072
)

# Derive public key
public_key = private_key.public_key()


# Serialize private key
private_key_bytes = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

# Serialize public key
public_key_bytes = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)


# Save files exclusively (never overwrite existing files)
try:
    with private_key_path.open("xb") as private_file:
        private_file.write(private_key_bytes)

    # Restrict private key permissions on Linux/macOS
    if private_key_path.exists():
        import os
        if os.name != "nt":
            private_key_path.chmod(0o600)

    with public_key_path.open("xb") as public_file:
        public_file.write(public_key_bytes)

except FileExistsError:
    # Remove only the private file created by this execution,
    # if public key creation failed because of an existing file.
    if private_key_path.exists() and not public_key_path.exists():
        private_key_path.unlink(missing_ok=True)

    raise SystemExit(
        "An RSA key file already exists. "
        "Generation stopped to prevent overwriting existing keys."
    )


print("RSA key pair generated successfully!")
print(f"Keys saved in: {secrets_folder}")
