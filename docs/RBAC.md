---
layout: default
title: RBAC
nav_order: 1
parent: Features
permalink: /rbac
description: "Role-Based Access Control configuration and management"
---

# Role-Based Access Control (RBAC)
{: .no_toc }

Configure granular permissions and roles.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

# Role-Based Access Control (RBAC) Overview

Flux Orchestrator includes a comprehensive RBAC system to control user access to clusters, resources, and administrative functions.

## Overview

The RBAC system consists of:
- **Users**: Authenticated via OAuth (GitHub or Microsoft Entra)
- **Roles**: Named collections of permissions
- **Permissions**: Specific actions on resources

## Built-in Roles

### Administrator
- **Full access** to all resources
- Can manage users and roles
- Can modify system settings
- Can manage Azure subscriptions and OAuth providers

### Operator
- Can **view and manage** clusters and Flux resources
- Can trigger reconciliations, suspend/resume resources
- Can view Azure subscriptions
- **Cannot** manage users, roles, or system settings

### Viewer
- **Read-only access** to all resources
- Can view clusters, resources, and logs
- **Cannot** modify anything

## Permission Model

Permissions follow the format `resource.action`:

| Resource | Actions | Description |
|----------|---------|-------------|
| `cluster` | read, create, update, delete | Cluster management |
| `resource` | read, reconcile, suspend, resume, update, delete | Flux resource operations |
| `user` | read, create, update, delete | User management |
| `role` | read, create, update, delete | Role management |
| `setting` | read, update | System settings |
| `azure` | read, create, update, delete | Azure AKS integration |

## Managing Users and Roles

### Via UI (Settings > RBAC)

1. **View Users**
   - Navigate to Settings > RBAC > Users
   - See all authenticated users and their assigned roles
   - Enable/disable user access

2. **Assign Roles to Users**
   - Click "Edit Roles" next to a user
   - Select one or more roles
   - Click "Save"

3. **Create Custom Roles**
   - Navigate to Settings > RBAC > Roles
   - Click "Create Role"
   - Enter name and description
   - Select permissions
   - Click "Create Role"

4. **Modify Role Permissions**
   - Click "Edit Permissions" on a role card
   - Select/deselect permissions
   - Click "Save"

5. **View All Permissions**
   - Navigate to Settings > RBAC > Permissions
   - Browse all available permissions grouped by resource

### Via API

#### List Users
```bash
curl http://localhost:8080/api/v1/rbac/users
```

#### Assign Roles to User
```bash
curl -X PUT http://localhost:8080/api/v1/rbac/users/{user-id}/roles \
  -H "Content-Type: application/json" \
  -d '{"role_ids": ["admin", "operator"]}'
```

#### Create Custom Role
```bash
curl -X POST http://localhost:8080/api/v1/rbac/roles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Developer",
    "description": "Can manage resources but not clusters",
    "permission_ids": [
      "resource.read",
      "resource.reconcile",
      "resource.suspend",
      "resource.resume",
      "cluster.read"
    ]
  }'
```

#### Assign Permissions to Role
```bash
curl -X PUT http://localhost:8080/api/v1/rbac/roles/{role-id}/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "permission_ids": [
      "cluster.read",
      "resource.read",
      "resource.reconcile"
    ]
  }'
```

## User Lifecycle

### First Login
1. User authenticates via OAuth (GitHub or Microsoft Entra)
2. User record is automatically created
3. Default "Viewer" role is assigned
4. User can access the UI with read-only permissions

### Role Assignment
1. Administrator navigates to Settings > RBAC > Users
2. Finds the user and clicks "Edit Roles"
3. Assigns appropriate role(s)
4. User's permissions are updated immediately

### Disabling Access
1. Administrator can disable a user without deleting their record
2. Disabled users cannot log in
3. User can be re-enabled later

### Deleting Users
1. Administrator can permanently delete user records
2. All role assignments are removed
3. User must re-authenticate to create a new account

## Custom Role Examples

### DevOps Engineer
```json
{
  "name": "DevOps Engineer",
  "description": "Can manage clusters and resources, view settings",
  "permissions": [
    "cluster.read", "cluster.create", "cluster.update",
    "resource.*",
    "azure.read",
    "setting.read"
  ]
}
```

### Release Manager
```json
{
  "name": "Release Manager",
  "description": "Can trigger reconciliations and view resources",
  "permissions": [
    "cluster.read",
    "resource.read",
    "resource.reconcile",
    "resource.suspend",
    "resource.resume"
  ]
}
```

### Security Auditor
```json
{
  "name": "Security Auditor",
  "description": "Read-only access to everything",
  "permissions": [
    "*.read"
  ]
}
```

## Security Considerations

1. **Built-in roles cannot be deleted** - Administrator, Operator, and Viewer roles are protected
2. **New users start with minimal access** - Default "Viewer" role on first login
3. **OAuth required for RBAC** - Users must authenticate via GitHub or Microsoft Entra
4. **Permission checks on every API call** - Server-side enforcement
5. **No password storage** - OAuth handles authentication
6. **Audit logs track all actions** - See who did what and when

## Configuration

### Enable RBAC
RBAC is automatically enabled when OAuth is configured:

```bash
# In .env or environment variables
OAUTH_ENABLED=true
OAUTH_PROVIDER=github  # or entra
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URL=http://localhost:8080/api/v1/auth/callback
```

### Restrict Access to Specific Users
```bash
# Optional: limit access to specific emails/usernames
OAUTH_ALLOWED_USERS=user1@example.com,user2@example.com
```

## Troubleshooting

### User Can't See Certain Features
- Check user's assigned roles in Settings > RBAC > Users
- Verify role has necessary permissions in Settings > RBAC > Roles
- Ensure user is enabled (not disabled)

### Built-in Role Modifications
- Built-in roles (Administrator, Operator, Viewer) cannot be edited or deleted
- Create a custom role if built-in roles don't fit your needs

### Permission Not Working
- Check that permission exists in Settings > RBAC > Permissions
- Verify role has the permission assigned
- Verify user has the role assigned
- Check server logs for permission denials

### New OAuth Users Not Appearing
- Verify OAuth is configured correctly
- Check that user successfully authenticated
- User record is created automatically on first successful login
- Check database logs for any errors

## API Reference

| Endpoint | Method | Description | Required Permission |
|----------|--------|-------------|---------------------|
| `/rbac/users` | GET | List all users | `user.read` |
| `/rbac/users/{id}` | GET | Get user details | `user.read` |
| `/rbac/users/{id}` | PUT | Update user | `user.update` |
| `/rbac/users/{id}` | DELETE | Delete user | `user.delete` |
| `/rbac/users/{id}/roles` | PUT | Assign roles to user | `user.update` |
| `/rbac/roles` | GET | List all roles | `role.read` |
| `/rbac/roles` | POST | Create role | `role.create` |
| `/rbac/roles/{id}` | GET | Get role details | `role.read` |
| `/rbac/roles/{id}` | PUT | Update role | `role.update` |
| `/rbac/roles/{id}` | DELETE | Delete role | `role.delete` |
| `/rbac/roles/{id}/permissions` | PUT | Assign permissions to role | `role.update` |
| `/rbac/permissions` | GET | List all permissions | `role.read` |

## Database Schema

### Users Table
```sql
- id (PK)
- email (unique)
- name
- provider (github/entra)
- enabled (boolean)
- created_at
- updated_at
```

### Roles Table
```sql
- id (PK)
- name (unique)
- description
- built_in (boolean)
- created_at
- updated_at
```

### Permissions Table
```sql
- id (PK)
- resource (cluster, resource, user, etc.)
- action (read, create, update, delete, etc.)
- description
- created_at
```

### Join Tables
- `user_roles`: Many-to-many between users and roles
- `role_permissions`: Many-to-many between roles and permissions
