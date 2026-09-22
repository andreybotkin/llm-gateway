import os
import stat
import tempfile
import time

import google.auth
from google.auth.transport.requests import Request

TOKEN_DIR = "/var/run/vertex"
TOKEN_PATH = os.path.join(TOKEN_DIR, "token")
CREDENTIALS = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "/run/secrets/vertex-sa.json")
SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def write_token(token: str) -> None:
    os.makedirs(TOKEN_DIR, mode=0o755, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".token.", dir=TOKEN_DIR)
    try:
        os.fchmod(fd, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(token)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, TOKEN_PATH)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def main() -> None:
    credentials, _ = google.auth.load_credentials_from_file(CREDENTIALS, scopes=SCOPES)
    while True:
        credentials.refresh(Request())
        write_token(credentials.token)
        time.sleep(2400)


if __name__ == "__main__":
    main()
