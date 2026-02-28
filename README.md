# shanta-ai

AI package similar to coda-ai and dse-ai

## Installation

```bash
npm install shanta-ai
```

## Usage

```typescript
import { SantaAI } from 'shanta-ai';

// Your code here
```

## CLI

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

**Check Authentication**

```bash
# Check your current authentication
shanta-ai whoami

# Logout
shanta-ai logout
```

### Other Commands

```bash
# Show help
shanta-ai --help

# Show version
shanta-ai --version
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
