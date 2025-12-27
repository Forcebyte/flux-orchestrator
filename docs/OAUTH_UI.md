# OAuth Provider Configuration UI - Implementation Summary

## Overview
Added a comprehensive OAuth provider configuration system similar to the Azure AKS subscriptions feature. This allows users to configure and manage OAuth authentication providers (GitHub and Entra ID/Azure AD) through the UI.

## Changes Made

### Backend Changes

#### 1. Database Model (`backend/internal/models/models.go`)
- Added `OAuthProvider` struct with fields:
  - `ID`, `Name`, `Provider` (github/entra)
  - `ClientID`, `ClientSecret` (encrypted), `TenantID` (for Entra)
  - `RedirectURL`, `Scopes`, `AllowedUsers`
  - `Enabled`, `Status`, timestamps

#### 2. API Endpoints (`backend/internal/api/server.go`)
- **GET** `/api/v1/oauth/providers` - List all OAuth providers
- **POST** `/api/v1/oauth/providers` - Create new provider
- **GET** `/api/v1/oauth/providers/{id}` - Get specific provider
- **PUT** `/api/v1/oauth/providers/{id}` - Update provider
- **DELETE** `/api/v1/oauth/providers/{id}` - Delete provider
- **POST** `/api/v1/oauth/providers/{id}/test` - Test provider configuration

Features:
- Client secrets are encrypted using the existing Fernet encryption
- Validation for required fields (ClientID, ClientSecret, RedirectURL)
- Tenant ID validation for Entra ID providers
- Configuration testing to validate OAuth setup

#### 3. Database Migration (`backend/cmd/server/main.go`)
- Added `&models.OAuthProvider{}` to schema initialization

### Frontend Changes

#### 1. TypeScript Types (`frontend/src/types.ts`)
- Added `OAuthProvider` interface matching backend model

#### 2. API Client (`frontend/src/api.ts`)
- Added `oauthApi` with CRUD operations:
  - `listProviders()`, `getProvider(id)`, `createProvider(data)`
  - `updateProvider(id, data)`, `deleteProvider(id)`
  - `testProvider(id)`

#### 3. OAuth Providers Component (`frontend/src/components/OAuthProviders.tsx`)
- Card-based list view showing all configured providers
- Provider badges for GitHub (🐙) and Entra ID (🔷)
- Status badges (healthy/unhealthy/unknown)
- Enabled indicator
- Actions: Test, Edit, Delete
- Add/Edit dialog with:
  - Provider type selection (GitHub/Entra ID)
  - Client ID and Secret fields
  - Tenant ID field (for Entra ID only)
  - Redirect URL configuration
  - Scopes (comma-separated, optional)
  - Allowed users restriction (comma-separated, optional)
  - Enable/disable toggle
  - Setup instructions for each provider type

#### 4. Settings Integration (`frontend/src/components/Settings.tsx`)
- Added "OAuth" tab alongside "General" and "Azure AKS"
- Renders `OAuthProviders` component when tab is active

#### 5. Styling (`frontend/src/styles/OAuthProviders.css`)
- Consistent with existing Azure subscriptions styling
- Full dark mode support using CSS variables
- Provider-specific badge colors (GitHub black, Entra blue)
- Responsive grid layout
- Modal dialog styles for add/edit forms

#### 6. CSS Variables (`frontend/src/App.css`)
- Added missing variables for better theme support:
  - `--card-bg`, `--input-bg`, `--disabled-bg`, `--hover-bg`
  - `--border-hover`, `--primary-color`, `--primary-hover`
  - `--error-bg/border/text`, `--info-bg/border`

## Usage

### Setting Up GitHub OAuth
1. Go to Settings → OAuth tab
2. Click "Add Provider"
3. Fill in the form:
   - Name: "GitHub OAuth"
   - Provider: GitHub
   - Client ID: From GitHub OAuth App settings
   - Client Secret: From GitHub OAuth App
   - Redirect URL: `https://your-domain.com/api/v1/auth/callback`
   - Scopes: `user:email,read:user` (optional)
   - Allowed Users: Leave empty to allow all users
   - Enable: Check to activate
4. Click "Add Provider"
5. Test the configuration using the 🔌 button

### Setting Up Entra ID (Azure AD) OAuth
1. Go to Settings → OAuth tab
2. Click "Add Provider"
3. Fill in the form:
   - Name: "Entra ID SSO"
   - Provider: Entra ID
   - Client ID: From Azure App Registration
   - Client Secret: From Azure App Registration
   - Tenant ID: Your Azure AD tenant ID
   - Redirect URL: `https://your-domain.com/api/v1/auth/callback`
   - Scopes: `openid,profile,email` (optional)
   - Allowed Users: Comma-separated emails (optional)
   - Enable: Check to activate
4. Click "Add Provider"
5. Test the configuration

## Security Features
- Client secrets are encrypted at rest using Fernet encryption
- Secrets are never returned in API responses (except when creating)
- Test endpoint validates configuration without exposing secrets
- Optional user restriction via allowed users list
- Provider can be disabled without deletion

## Database Schema
```sql
CREATE TABLE oauth_providers (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,  -- 'github' or 'entra'
  client_id VARCHAR(255) NOT NULL,
  client_secret TEXT NOT NULL,     -- Encrypted
  tenant_id VARCHAR(100),          -- For Entra ID
  redirect_url VARCHAR(500) NOT NULL,
  scopes TEXT,                     -- Comma-separated
  allowed_users TEXT,              -- Comma-separated
  enabled BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'unknown',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Testing
After adding a provider:
1. Use the 🔌 Test button to validate configuration
2. Status will update to "healthy" if valid
3. Check the redirect URL is correctly configured in your OAuth app
4. Test actual authentication flow at `/api/v1/auth/login`

## Future Enhancements
- Support for additional OAuth providers (GitLab, Google, etc.)
- OAuth provider usage statistics
- Session management UI
- User/group mapping configuration
- Multi-provider fallback support
