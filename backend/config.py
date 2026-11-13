from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL


class Settings(BaseSettings):
    # Read from the environment, and from envs/.env.local when running outside Docker, from the
    # project root.
    model_config = SettingsConfigDict(env_file="envs/.env.local", extra="ignore")

    environment: Literal["local", "production"] = "local"
    log_level: str = "info"
    # The interactive docs (/docs, /redoc, /openapi.json): on locally, off in production unless
    # true.
    api_docs: bool | None = None

    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    # Azure's flexible server only takes encrypted connections, so production defaults to "require".
    postgres_sslmode: str | None = None

    # Signs login, email verification and password reset tokens.
    # Generate one with: openssl rand -hex 32
    secret_key: str
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week

    # Used to build the links in emails, and the one site allowed to call the API from the browser (CORS).
    # In production the FE and the API are on the same domain (openread.example.com and
    # api.openread.example.com), so the login cookie counts as first-party.
    fe_url: str = "http://localhost:5173"

    # Outgoing email (production only; locally emails are printed to the logs).
    # Azure Communication Services: the resource's connection string, and the
    # "MailFrom" address of its verified domain, e.g. DoNotReply@<id>.azurecomm.net
    azure_communication_connection_string: str | None = None
    email_from: str | None = None

    # Pictures (production only; locally the API serves the files itself). Azure Blob Storage: the
    # account's connection string, and a container with anonymous read access for blobs.
    azure_storage_connection_string: str | None = None
    azure_storage_container_media: str = "media"

    # The Docker image the API runs, set on the App Service by the deploy workflow (e.g. "42-ab12cd").
    # /health reports it, so the workflow can tell when the new build is serving.
    image_tag: str = "dev"

    # Where rate-limit counters live. "memory://" is per API process; use e.g.
    # "redis://redis:6379" to share them between workers.
    rate_limit_storage_uri: str = "memory://"

    @model_validator(mode="after")
    def check_production(self) -> "Settings":
        if self.environment != "production":
            return self
        if self.secret_key.startswith("change-me") or len(self.secret_key) < 32:
            raise ValueError("Set SECRET_KEY to a random value: openssl rand -hex 32")
        missing = [
            name.upper()
            for name in ("azure_communication_connection_string", "email_from", "azure_storage_connection_string")
            if not getattr(self, name)
        ]
        if missing:
            raise ValueError(f"Set {', '.join(missing)} in production")
        return self

    @property
    def database_url(self) -> URL:
        sslmode = self.postgres_sslmode or ("require" if self.is_production else None)
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
            query={"sslmode": sslmode} if sslmode else {},
        )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def show_docs(self) -> bool:
        return self.api_docs if self.api_docs is not None else not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
