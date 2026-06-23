from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from services.config import settings
from services.firebase import get_firebase_app

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

FRONTEND_ORIGIN = "https://powerprobebatteries.netlify.app"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


def send_reset_email(to_email: str, reset_link: str) -> None:
    if not all([settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.smtp_from_email]):
        raise RuntimeError("SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset Your PowerProbe Password"
    msg["From"] = settings.smtp_from_email
    msg["To"] = to_email

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1e293b; font-size: 22px; margin: 0;">PowerProbe</h1>
        </div>
        <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 12px;">Reset Your Password</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                Click the button below to create a new password for your account. This link will expire in 1 hour.
            </p>
            <div style="text-align: center; margin: 28px 0;">
                <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    Reset Password
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                If you didn't request a password reset, you can safely ignore this email.
            </p>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 16px;">
            PowerProbe Battery Analytics Platform
        </p>
    </div>
    """

    text_body = f"Reset your PowerProbe password by visiting: {reset_link}"

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_from_email, to_email, msg.as_string())


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(body: ForgotPasswordRequest):
    app = get_firebase_app()
    if not app:
        raise HTTPException(status_code=500, detail="Firebase is not configured on the server.")

    try:
        from firebase_admin import auth

        action_code_settings = auth.ActionCodeSettings(
            url=FRONTEND_ORIGIN,
            handle_code_in_app=False,
        )

        firebase_link = auth.generate_password_reset_link(
            body.email,
            action_code_settings,
        )

        parsed = urlparse(firebase_link)
        params = parse_qs(parsed.query)
        oob_code = params.get("oobCode", [None])[0]

        if not oob_code:
            raise HTTPException(status_code=500, detail="Failed to generate reset code.")

        custom_link = f"{FRONTEND_ORIGIN}/?oobCode={oob_code}"

        send_reset_email(body.email, custom_link)

        return ForgotPasswordResponse(
            message="If an account with that email exists, a reset link has been sent.",
        )

    except smtplib.SMTPException as exc:
        logger.error("Failed to send reset email: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to send email. Please try again later.")

    except Exception as exc:
        logger.warning("Password reset failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to process password reset.")
