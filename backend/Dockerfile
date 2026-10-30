# ==========================================
# Stage 1: Build application with Nuitka
# ==========================================
FROM python:3.14.10-slim-trixie AS builder

WORKDIR /build-src

# Install tools required by Nuitka
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        patchelf \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies and Nuitka
COPY requirements.txt .

RUN pip install --no-cache-dir \
    -r requirements.txt \
    nuitka

# Copy application source
COPY app/ ./app/
COPY run.py .

# Compile the application
RUN python -m nuitka \
    --mode=standalone \
    --output-dir=/build \
    --output-filename=workshop_inventory_backend \
    --include-package=app \
    --include-package=uvicorn \
    run.py


# ==========================================
# Stage 2: Minimal runtime image
# ==========================================
FROM debian:trixie-slim AS runtime

WORKDIR /opt/workshop_inventory_backend

# Install wget for healthcheck (wget smaller than curl)
RUN apt-get update && \
    apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*

HEALTHCHECK CMD wget -q -O /dev/null http://localhost:8888/api/health || exit 1

# Copy ONLY the compiled distribution
COPY --from=builder /build/run.dist/ ./

# Run as a non-root user
RUN useradd --system --uid 10001 appuser
USER appuser

# Starlette / Uvicorn port
EXPOSE 8888

# Start the compiled application
ENTRYPOINT ["./workshop_inventory_backend"]
