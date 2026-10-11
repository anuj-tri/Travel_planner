import os
import resend
from dotenv import load_dotenv

load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")


def send_reset_password_email(recipient_email: str, reset_link: str):
    params: resend.Emails.SendParams = {
        "from": "Smart Travel Planner <onboarding@resend.dev>",
        "to": [recipient_email],
        "subject": "Reset Your Smart Travel Planner Password",
        "html": f"""
        <h2>Reset Your Password</h2>

        <p>
            We received a request to reset your
            Smart Travel Planner password.
        </p>

        <p>
            Click the button below to reset your password:
        </p>

        <p>
            <a href="{reset_link}">
                Reset Password
            </a>
        </p>

        <p>
            This link will expire in 7 minutes.
        </p>

        <p>
            If you did not request a password reset,
            you can safely ignore this email.
        </p>

        <p>
            Regards,<br>
            Smart Travel Planner
        </p>
        """,
    }

    email = resend.Emails.send(params)

    return email
