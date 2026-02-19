FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    zsh \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*
