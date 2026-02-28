# shanta-ai

AI CLI tool for Shanta Securities EasyX platform

## Installation

### Global Installation (Recommended)

```bash
# Install globally
npm install -g shanta-ai

# Or install from source
git clone <repository-url>
cd shanta-ai
npm install
npm run build
npm link
```

### Local Installation

```bash
npm install shanta-ai
```

## CLI Usage

### Authentication

**API-Based Login**

Simple and direct authentication using the Shanta Securities API:

```bash
# Interactive authentication
shanta-ai auth

# Non-interactive with flags
shanta-ai auth --username 123ABC --password yourpassword
shanta-ai auth -u 123ABC -p yourpassword

# You'll be prompted for:
# - Account Code (e.g., 123ABC)
# - Password
```

**Manual Token (Alternative)**

If you already have a bearer token:

```bash
shanta-ai auth YOUR_BEARER_TOKEN
```

**Auto-Refresh (Optional)**

Set environment variable for automatic token refresh:

```bash
export SHANTA_AI_PASSWORD=yourpassword
```

When enabled, expired tokens are automatically refreshed without interruption.

### Commands

**Check Profile Information**

```bash
# Basic profile info
shanta-ai whoami

# Detailed profile with address and bank details
shanta-ai whoami --verbose
shanta-ai whoami -v
```

**View Portfolio**

```bash
# Default formatted view
shanta-ai portfolio

# JSON output
shanta-ai portfolio --json

# Toon encoded format
shanta-ai portfolio --toon

# Markdown table
shanta-ai portfolio --markdown
```

**View Portfolio Trend**

```bash
# Default period (1 month)
shanta-ai portfolio-trend

# Specific time periods: 1M, 3M, 6M, 1y, Max
shanta-ai portfolio-trend 3M
shanta-ai portfolio-trend 1y

# With output formats
shanta-ai portfolio-trend 6M --json
shanta-ai portfolio-trend 1y --toon
shanta-ai portfolio-trend Max --markdown
```

**Logout**

```bash
shanta-ai logout
```

**Help & Version**

```bash
# Show help
shanta-ai --help

# Show version
shanta-ai --version
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Link for global testing
npm link
```

## Features

- ✅ Secure authentication with Shanta Securities API
- ✅ Profile management and viewing
- ✅ Portfolio holdings and analytics
- ✅ Portfolio performance trends with ASCII charts
- ✅ Automatic token refresh on expiry
- ✅ Multiple output formats (default, JSON, toon, markdown)
- ✅ Bearer token storage for persistent sessions
- ✅ JWT expiry tracking with auto-refresh
- ✅ Realistic browser headers to avoid detection
- ✅ Support for both manual and automated authentication

## License

MIT
