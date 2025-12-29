---
layout: default
title: OAuth Authentication
nav_order: 2
parent: Features
permalink: /oauth
description: "GitHub and Microsoft Entra ID OAuth integration"
---

# OAuth Authentication
{: .no_toc }

Configure GitHub and Microsoft Entra ID authentication.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

# OAuth Authentication Overview Setup Guide

Flux Orchestrator supports optional OAuth authentication via GitHub or Microsoft Entra (Azure AD). This guide walks through the setup process for both providers.

## Overview

OAuth authentication is **optional** and disabled by default. When disabled, the application runs in open mode with no authentication required. When enabled, users must authenticate with the configured OAuth provider before accessing the application.

## Features

- **Provider Support**: GitHub and Microsoft Entra (Azure AD)
- **Optional User Restriction**: Limit access to specific email addresses
- **Session Management**: 24-hour session expiration with automatic cleanup
- **Secure Cookies**: HttpOnly, SameSite cookies for session tokens
- **CSRF Protection**: State parameter validation during OAuth callback

## Architecture

```
┌─────────┐      ┌──────────────┐      ┌─────────────┐
│ Browser │─────▶│ Flux Orch.   │─────▶│ OAuth       │
│         │◀─────│ Backend      │◀─────│ Provider    │
└─────────┘      └──────────────┘      └─────────────┘
                 (Session Store)        (GitHub/Entra)
```

Flow:
1. User clicks "Sign in"
2. Redirect to OAuth provider login
3. Provider redirects back with authorization code
4. Backend exchanges code for access token
5. Backend fetches user info and creates session
6. User is authenticated and can access the application

## Setup Guide

### GitHub OAuth Setup

#### 1. Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: Flux Orchestrator
   - **Homepage URL**: `http://localhost:8080` (or your production URL)
   - **Authorization callback URL**: `http://localhost:8080/api/v1/auth/callback`
4. Click "Register application"
5. Note the **Client ID**
6. Click "Generate a new client secret" and note the **Client Secret**

#### 2. Configure Environment Variables

```bash
# Enable OAuth
OAUTH_ENABLED=true
OAUTH_PROVIDER=github

# GitHub OAuth credentials
OAUTH_CLIENT_ID=your_github_client_id_here
OAUTH_CLIENT_SECRET=your_github_client_secret_here
OAUTH_REDIRECT_URL=http://localhost:8080/api/v1/auth/callback

# Scopes (GitHub)
OAUTH_SCOPES=read:user,user:email

# Optional: Restrict to specific users
OAUTH_ALLOWED_USERS=user1@example.com,user2@example.com
```

### Microsoft Entra (Azure AD) OAuth Setup

#### 1. Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Fill in the application details:
   - **Name**: Flux Orchestrator
   - **Supported account types**: Choose based on your needs (typically "Single tenant")
   - **Redirect URI**: Web - `http://localhost:8080/api/v1/auth/callback`
5. Click "Register"
6. Note the **Application (client) ID** from the Overview page

#### 2. Create Client Secret

1. In your app registration, go to "Certificates & secrets"
2. Click "New client secret"
3. Add a description and choose an expiration period
4. Click "Add"
5. **Important**: Copy the secret value immediately (it won't be shown again)

#### 3. Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph" → "Delegated permissions"
4. Add these permissions:
   - `User.Read` (allows reading basic user profile)
   - `email` (allows reading user email)
   - `openid` (OpenID Connect sign-in)
   - `profile` (allows reading basic profile)
5. Click "Add permissions"
6. Click "Grant admin consent" if you have admin rights

#### 4. Configure Environment Variables

```bash
# Enable OAuth
OAUTH_ENABLED=true
OAUTH_PROVIDER=entra

# Entra OAuth credentials
OAUTH_CLIENT_ID=your_entra_application_id_here
OAUTH_CLIENT_SECRET=your_entra_client_secret_here
OAUTH_REDIRECT_URL=http://localhost:8080/api/v1/auth/callback

# Scopes (Entra)
OAUTH_SCOPES=openid,profile,email

# Optional: Restrict to specific users
OAUTH_ALLOWED_USERS=user1@contoso.com,user2@contoso.com
```

## Production Deployment

### Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
   - Update `OAUTH_REDIRECT_URL` to use `https://`
   - Set secure cookie flags in production builds

2. **Secret Management**:
   - Store OAuth credentials in secure secret management (e.g., Kubernetes Secrets, Azure Key Vault)
   - Never commit `.env` files with real credentials to version control
   - Rotate client secrets regularly

3. **User Restrictions**:
   - Use `OAUTH_ALLOWED_USERS` to limit access to specific users
   - Consider implementing role-based access control (RBAC) for finer-grained permissions

### Example Kubernetes Deployment

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: flux-orchestrator-oauth
type: Opaque
stringData:
  oauth-client-id: "your_client_id"
  oauth-client-secret: "your_client_secret"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flux-orchestrator
spec:
  template:
    spec:
      containers:
      - name: flux-orchestrator
        image: flux-orchestrator:latest
        env:
        - name: OAUTH_ENABLED
          value: "true"
        - name: OAUTH_PROVIDER
          value: "github"  # or "entra"
        - name: OAUTH_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: flux-orchestrator-oauth
              key: oauth-client-id
        - name: OAUTH_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: flux-orchestrator-oauth
              key: oauth-client-secret
        - name: OAUTH_REDIRECT_URL
          value: "https://flux-orchestrator.example.com/api/v1/auth/callback"
        - name: OAUTH_SCOPES
          value: "read:user,user:email"
        - name: OAUTH_ALLOWED_USERS
          value: "admin@example.com,ops@example.com"
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  flux-orchestrator:
    image: flux-orchestrator:latest
    environment:
      OAUTH_ENABLED: "true"
      OAUTH_PROVIDER: "github"
      OAUTH_CLIENT_ID: "${OAUTH_CLIENT_ID}"
      OAUTH_CLIENT_SECRET: "${OAUTH_CLIENT_SECRET}"
      OAUTH_REDIRECT_URL: "http://localhost:8080/api/v1/auth/callback"
      OAUTH_SCOPES: "read:user,user:email"
      OAUTH_ALLOWED_USERS: "user1@example.com,user2@example.com"
    ports:
      - "8080:8080"
```

## Testing

### Test OAuth Flow Locally

1. Set environment variables in `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your OAuth credentials
   ```

2. Start the application:
   ```bash
   make run  # or docker-compose up
   ```

3. Navigate to `http://localhost:8080`
4. Click "Sign in with OAuth"
5. Complete the OAuth flow with your provider
6. You should be redirected back and authenticated

### Verify Authentication

Check the auth status endpoint:
```bash
curl http://localhost:8080/api/v1/auth/status
# Response: {"enabled":true}
```

Check current user (requires authentication):
```bash
curl -b cookies.txt http://localhost:8080/api/v1/auth/me
# Response: {"id":"123","email":"user@example.com","name":"User Name","username":"username","provider":"github"}
```

## Troubleshooting

### Common Issues

#### 1. "Invalid OAuth state" Error

**Cause**: State parameter mismatch (possible CSRF attack or cookie issues)

**Solution**:
- Clear browser cookies
- Ensure cookies are enabled
- Check that `OAUTH_REDIRECT_URL` matches exactly with the registered callback URL

#### 2. "Token exchange failed" Error

**Cause**: Invalid client credentials or authorization code

**Solution**:
- Verify `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` are correct
- Ensure the OAuth app is properly configured in the provider's console
- Check network connectivity to the OAuth provider

#### 3. "You are not authorized" Error

**Cause**: User email not in `OAUTH_ALLOWED_USERS` list

**Solution**:
- Add the user's email to `OAUTH_ALLOWED_USERS`
- Or remove `OAUTH_ALLOWED_USERS` to allow all users from the provider

#### 4. Session Expires Immediately

**Cause**: System clock skew or incorrect session expiration

**Solution**:
- Ensure server time is synchronized (NTP)
- Check for any date/time issues in logs

#### 5. Redirect Loop

**Cause**: Frontend and backend URL mismatch

**Solution**:
- Ensure `OAUTH_REDIRECT_URL` points to the backend API endpoint
- Verify CORS settings if frontend and backend are on different domains

### Debug Mode

Enable verbose logging by checking application logs:
```bash
docker logs flux-orchestrator -f
```

Look for OAuth-related log messages:
- `OAuth enabled with provider: github`
- `OAuth token exchange failed: ...`
- `Failed to get user info: ...`
- `User not allowed: ...`

## Disabling OAuth

To disable OAuth and run in open mode:

```bash
OAUTH_ENABLED=false
```

Or simply omit the `OAUTH_ENABLED` variable (defaults to `false`).

## Migration from Open Mode to OAuth

1. Enable OAuth with the steps above
2. All existing sessions will be invalidated
3. Users will be prompted to authenticate on next visit
4. No data migration required

## API Reference

### Auth Endpoints

#### `GET /api/v1/auth/status`
Check if authentication is enabled.

**Response**:
```json
{
  "enabled": true
}
```

#### `GET /api/v1/auth/login`
Initiate OAuth login flow. Redirects to OAuth provider.

#### `GET /api/v1/auth/callback`
OAuth callback endpoint. Handles authorization code exchange.

**Query Parameters**:
- `code`: Authorization code from OAuth provider
- `state`: CSRF protection state parameter

#### `GET /api/v1/auth/me`
Get current authenticated user information.

**Response**:
```json
{
  "id": "123456",
  "email": "user@example.com",
  "name": "User Name",
  "username": "username",
  "provider": "github"
}
```

#### `POST /api/v1/auth/logout`
Logout current user and invalidate session.

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

## Session Management

- **Session Duration**: 24 hours (configurable in code)
- **Storage**: In-memory (server restart clears sessions)
- **Cleanup**: Automatic hourly cleanup of expired sessions
- **Cookie**: `session_token` (HttpOnly, SameSite=Lax)

### Scaling Considerations

The current implementation uses in-memory session storage. For production deployments with multiple replicas, consider:

1. **Redis Session Store**: Shared session storage across instances
2. **JWT Tokens**: Stateless authentication with signed tokens
3. **Sticky Sessions**: Route users to the same instance (load balancer configuration)

## Security Best Practices

1. ✅ **Use HTTPS in production** - Protects tokens in transit
2. ✅ **Set secure cookie flags** - Configure `Secure: true` with HTTPS
3. ✅ **Rotate secrets regularly** - Update OAuth client secrets periodically
4. ✅ **Restrict user access** - Use `OAUTH_ALLOWED_USERS` for sensitive environments
5. ✅ **Monitor authentication logs** - Track failed auth attempts
6. ✅ **Keep dependencies updated** - Update OAuth libraries for security patches

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting) above
- Review application logs for error messages
- Consult OAuth provider documentation:
  - [GitHub OAuth Docs](https://docs.github.com/en/developers/apps/building-oauth-apps)
  - [Microsoft Entra OAuth Docs](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
