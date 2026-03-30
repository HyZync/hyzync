# Production Stage
FROM python:3.9-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Final Runtime Stage
FROM python:3.9-slim

WORKDIR /app

# Create a non-root user
RUN groupadd -r hyzync && useradd -r -g hyzync hyzync

# Copy only installed packages from builder
COPY --from=builder /root/.local /home/hyzync/.local
ENV PATH=/home/hyzync/.local/bin:$PATH

# Copy application code
COPY . .

# Ensure data directory exists and is writable
RUN mkdir -p data && chown -R hyzync:hyzync /app

# Switch to non-root user
USER hyzync

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Run with Gunicorn
CMD ["gunicorn", "-c", "gunicorn_conf.py", "main:app"]
