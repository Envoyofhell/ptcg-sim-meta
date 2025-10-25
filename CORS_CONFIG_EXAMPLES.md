# CORS Configuration Examples
# Copy these files and add your values to GitHub Secrets

## Environment Variables for GitHub Secrets

### Required Variables:
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of always allowed domains
- `CORS_LIMITED_ORIGINS` - Comma-separated list of domains to limit after X images  
- `CORS_BLOCKED_ORIGINS` - Comma-separated list of always blocked domains
- `CORS_ORIGINS_LIMITS` - JSON object with limits per domain

### Optional Variables:
- `CORS_ENABLED` - Master switch (default: "true")
- `CORS_DEBUG_MODE` - Enable debug logging (default: "false")
- `CORS_CONSOLE_LOGGING` - Enable console logging (default: "false")

## Example Values:

### CORS_ALLOWED_ORIGINS
```
https://admin.socket.io,https://ptcg-sim-meta.pages.dev,http://localhost:3000,https://meta-ptcg.org,https://test.meta-ptcg.org,https://*.onrender.com
```

### CORS_LIMITED_ORIGINS
```
*.duckdns.org,*.ngrok.io
```

### CORS_BLOCKED_ORIGINS
```
malicious-site.com,spam-domain.org,phishing-site.net
```

### CORS_ORIGINS_LIMITS
```json
{"*.duckdns.org":5,"*.ngrok.io":3,"default":5}
```

## How It Works:

1. **ALLOWED** - Domains in CORS_ALLOWED_ORIGINS are always allowed
2. **LIMITED** - Domains in CORS_LIMITED_ORIGINS are blocked after X images
3. **BLOCKED** - Domains in CORS_BLOCKED_ORIGINS are always blocked
4. **DEFAULT** - Unknown domains use the default limit from CORS_ORIGINS_LIMITS

## Setup Instructions:

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add each variable as a repository secret
4. Deploy your application
5. The CORS system will automatically use these values

## Testing:

- Enable `CORS_CONSOLE_LOGGING` to see CORS decisions in browser console
- Enable `CORS_DEBUG_MODE` for detailed logging
- Use `advancedCORSManager.getStatus()` in browser console to check current settings
