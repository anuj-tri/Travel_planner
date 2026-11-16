import os
import smtplib
import ssl
from dotenv import load_dotenv
from email.message import EmailMessage

load_dotenv()

GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")


def send_reset_password_email(recipient_email: str, reset_link: str):
    if not GMAIL_ADDRESS or not  GMAIL_APP_PASSWORD:
        raise RuntimeError("Gmail SMTP credentials are missing from .env")

    message = EmailMessage()
    message["Subject"] = 'Reset your Smart Travel Planner Password'
    message["From"] = f"Smart Travel Planner <{GMAIL_ADDRESS}>"
    message["To"] = recipient_email

    message.set_content(
        f"""
We received a request to reset your Smart Travel Planner password.

Open this link to reset your password:
{reset_link}

This link will expire in 7 minutes.

If you did not request a password reset, you can safely ignore this email.

Regards,
Smart Travel Planner
"""
    )

    message.add_alternative(
        f"""
        <html>
          <body>
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your Smart Travel Planner password.</p>
            <p><a href="{reset_link}">Reset Password</a></p>
            <p>This link will expire in 7 minutes.</p>
            <p>If you did not request a password reset, you can safely ignore this email.</p>
            <p>Regards,<br>Smart Travel Planner</p>
          </body>
        </html>
        """,
        subtype="html",
    )

    context = ssl.create_default_context()

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls(context=context)
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD.replace(" ", ""))
        server.send_message(message)
    return {"message": "Password reset email sent successfully"}
