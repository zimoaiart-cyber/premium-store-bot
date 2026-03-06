# Premium Store Bot Docker Image
FROM denoland/deno:alpine-1.40.0

WORKDIR /app

# Copy application code
COPY . .

# Cache dependencies
RUN deno cache bot.ts

# Expose port
EXPOSE 8080

# Set environment variables
ENV DENO_DEPLOYMENT_ID=docker
ENV LOG_LEVEL=info

# Run the bot
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "bot.ts"]
