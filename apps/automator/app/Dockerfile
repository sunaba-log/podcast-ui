# Base image used for preparing dependencies and for the final image
FROM python:3.12-slim as baseimage
ARG APP_DIR=app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN apt-get update && \
    apt-get install -y --no-install-recommends tzdata && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
# db-backup ジョブ用に pg_dump 17 を導入（Supabase は Postgres 17。pg_dump は
# サーバ以上のメジャーが必要なため、PGDG 公式 apt から 17 を明示インストールする）。
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates gnupg && \
    install -d /usr/share/postgresql-common/pgdg && \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client-17 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --upgrade pip uv
WORKDIR /workspace


# Prepare dependencies in separate builder to allow efficient docker caching
FROM baseimage as builder
ENV UV_CACHE_DIR=/tmp/docker_builder/uv_cache
COPY ${APP_DIR}/pyproject.toml ${APP_DIR}/uv.lock ./
RUN --mount=type=cache,target=$UV_CACHE_DIR uv sync --frozen


# Finally, build the application docker image using the base image and dependencies from the previous steps
FROM baseimage
ENV VIRTUAL_ENV=/workspace/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY --from=builder /workspace/.venv /workspace/.venv
COPY ${APP_DIR}/src ./src
ENV PYTHONPATH=/workspace/src
ENTRYPOINT [ "python", "-m", "main" ]
