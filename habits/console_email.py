"""Console email backend for local development.

Django's stock console backend prints the raw MIME message. For lines longer
than ~76 characters (like our reset/confirm links) that output is
quoted-printable encoded, so links get split with a trailing "=" and can't be
copied intact. This backend prints the decoded plain-text body instead, so
links show up exactly as they are and can be copied straight into the browser.
"""
from django.core.mail.backends.console import EmailBackend as ConsoleEmailBackend


class EmailBackend(ConsoleEmailBackend):
    def write_message(self, message):
        recipients = ', '.join(message.to)
        self.stream.write(
            f"\n--- EMAIL (dev console) ---\n"
            f"To: {recipients}\n"
            f"Subject: {message.subject}\n\n"
            f"{message.body}\n"
            f"{'-' * 79}\n"
        )
