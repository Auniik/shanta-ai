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
# Start authentication
shanta-ai auth

# You'll be prompted for:
# - Account Code (e.g., D00211)
# - Password
```

**Manual Token (Alternative)**

If you already have a bearer token:

```bash
shanta-ai auth YOUR_BEARER_TOKEN
```

### Commands

**Check Profile Information**

```bash
# Basic profile info
shanta-ai whoami

# Detailed profile with address and bank details
shanta-ai whoami --verbose
shanta-ai whoami -v
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

## Programmatic Usage

```typescript
import { ShantaAI } from 'shanta-ai';

const ai = new ShantaAI();
// Your code here
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
- ✅ Bearer token storage for persistent sessions
- ✅ Realistic browser headers to avoid detection
- ✅ Support for both manual and automated authentication

## License

MIT
