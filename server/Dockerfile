FROM python:3.11-slim

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies and clean apt cache to minimize image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    ezdxf \
    opencv-python-headless \
    shapely \
    cairosvg \
    flask

# Copy the server files
COPY . /app

# Run the API
CMD ["python", "api.py"]
