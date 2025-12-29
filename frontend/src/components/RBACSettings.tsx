import React, { useState, useEffect } from 'react';
import { rbacApi } from '../api';
import '../styles/RBACSettings.css';

interface User {
  id: string;
  email: string;
  name: string;
  provider: string;
  enabled: boolean;
  roles: Role[];
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  built_in: boolean;
  permissions: Permission[];
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

const RBACSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected items for editing
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (activeTab === 'users') {
        const response = await rbacApi.listUsers();
        setUsers(response.data);
      } else if (activeTab === 'roles') {
        const response = await rbacApi.listRoles();
        setRoles(response.data);
      } else if (activeTab === 'permissions') {
        const response = await rbacApi.listPermissions();
        setPermissions(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserEnabled = async (user: User) => {
    try {
      await rbacApi.updateUser(user.id, { enabled: !user.enabled });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleEditUserRoles = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleSaveUserRoles = async (roleIds: string[]) => {
    if (!selectedUser) return;
    
    try {
      await rbacApi.assignUserRoles(selectedUser.id, roleIds);
      setShowUserModal(false);
      setSelectedUser(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign roles');
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setShowRoleModal(true);
  };

  const handleSaveRolePermissions = async (permissionIds: string[]) => {
    if (!selectedRole) return;
    
    try {
      await rbacApi.assignRolePermissions(selectedRole.id, permissionIds);
      setShowRoleModal(false);
      setSelectedRole(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign permissions');
    }
  };

  const handleCreateRole = async (name: string, description: string, permissionIds: string[]) => {
    try {
      await rbacApi.createRole({ name, description, permission_ids: permissionIds });
      setShowCreateRoleModal(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    try {
      await rbacApi.deleteRole(roleId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const groupPermissionsByResource = (perms: Permission[]) => {
    const grouped: { [key: string]: Permission[] } = {};
    perms.forEach(p => {
      if (!grouped[p.resource]) grouped[p.resource] = [];
      grouped[p.resource].push(p);
    });
    return grouped;
  };

  return (
    <div className="rbac-settings">
      <div className="rbac-tabs">
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={activeTab === 'roles' ? 'active' : ''}
          onClick={() => setActiveTab('roles')}
        >
          Roles
        </button>
        <button
          className={activeTab === 'permissions' ? 'active' : ''}
          onClick={() => setActiveTab('permissions')}
        >
          Permissions
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="rbac-content">
          {activeTab === 'users' && (
            <div className="users-list">
              <h3>Users</h3>
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Provider</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.name || '-'}</td>
                      <td>{user.provider}</td>
                      <td>{user.roles.map(r => r.name).join(', ')}</td>
                      <td>
                        <span className={`status ${user.enabled ? 'enabled' : 'disabled'}`}>
                          {user.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => handleEditUserRoles(user)}>Edit Roles</button>
                        <button onClick={() => handleToggleUserEnabled(user)}>
                          {user.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="roles-list">
              <div className="roles-header">
                <h3>Roles</h3>
                <button className="btn-primary" onClick={() => setShowCreateRoleModal(true)}>
                  Create Role
                </button>
              </div>
              <div className="roles-grid">
                {roles.map(role => (
                  <div key={role.id} className="role-card">
                    <div className="role-header">
                      <h4>{role.name}</h4>
                      {role.built_in && <span className="badge">Built-in</span>}
                    </div>
                    <p>{role.description}</p>
                    <div className="role-permissions">
                      <strong>Permissions ({role.permissions.length}):</strong>
                      <div className="permission-tags">
                        {role.permissions.slice(0, 5).map(p => (
                          <span key={p.id} className="permission-tag">{p.resource}.{p.action}</span>
                        ))}
                        {role.permissions.length > 5 && (
                          <span className="permission-tag">+{role.permissions.length - 5} more</span>
                        )}
                      </div>
                    </div>
                    <div className="role-actions">
                      <button onClick={() => handleEditRole(role)}>Edit Permissions</button>
                      {!role.built_in && (
                        <button className="btn-danger" onClick={() => handleDeleteRole(role.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="permissions-list">
              <h3>All Permissions</h3>
              {Object.entries(groupPermissionsByResource(permissions)).map(([resource, perms]) => (
                <div key={resource} className="permission-group">
                  <h4>{resource.charAt(0).toUpperCase() + resource.slice(1)}</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perms.map(p => (
                        <tr key={p.id}>
                          <td><code>{p.action}</code></td>
                          <td>{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User Roles Modal */}
      {showUserModal && selectedUser && (
        <UserRolesModal
          user={selectedUser}
          availableRoles={roles}
          onSave={handleSaveUserRoles}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Role Permissions Modal */}
      {showRoleModal && selectedRole && (
        <RolePermissionsModal
          role={selectedRole}
          availablePermissions={permissions}
          onSave={handleSaveRolePermissions}
          onClose={() => {
            setShowRoleModal(false);
            setSelectedRole(null);
          }}
        />
      )}

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <CreateRoleModal
          availablePermissions={permissions}
          onSave={handleCreateRole}
          onClose={() => setShowCreateRoleModal(false)}
        />
      )}
    </div>
  );
};

// User Roles Modal Component
const UserRolesModal: React.FC<{
  user: User;
  availableRoles: Role[];
  onSave: (roleIds: string[]) => void;
  onClose: () => void;
}> = ({ user, availableRoles, onSave, onClose }) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    user.roles.map(r => r.id)
  );

  const toggleRole = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Edit Roles for {user.email}</h3>
        <div className="role-checkboxes">
          {availableRoles.map(role => (
            <label key={role.id}>
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.id)}
                onChange={() => toggleRole(role.id)}
              />
              <span>
                <strong>{role.name}</strong> - {role.description}
              </span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={() => onSave(selectedRoles)}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// Role Permissions Modal Component
const RolePermissionsModal: React.FC<{
  role: Role;
  availablePermissions: Permission[];
  onSave: (permissionIds: string[]) => void;
  onClose: () => void;
}> = ({ role, availablePermissions, onSave, onClose }) => {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    role.permissions.map(p => p.id)
  );

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    );
  };

  const groupedPermissions = availablePermissions.reduce((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {} as { [key: string]: Permission[] });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <h3>Edit Permissions for {role.name}</h3>
        <div className="permission-checkboxes">
          {Object.entries(groupedPermissions).map(([resource, perms]) => (
            <div key={resource} className="permission-resource-group">
              <h4>{resource.charAt(0).toUpperCase() + resource.slice(1)}</h4>
              {perms.map(perm => (
                <label key={perm.id}>
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                  />
                  <span>
                    <strong>{perm.action}</strong> - {perm.description}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={() => onSave(selectedPermissions)}>Save</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// Create Role Modal Component
const CreateRoleModal: React.FC<{
  availablePermissions: Permission[];
  onSave: (name: string, description: string, permissionIds: string[]) => void;
  onClose: () => void;
}> = ({ availablePermissions, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(id => id !== permId)
        : [...prev, permId]
    );
  };

  const groupedPermissions = availablePermissions.reduce((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {} as { [key: string]: Permission[] });

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Role name is required');
      return;
    }
    onSave(name, description, selectedPermissions);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={e => e.stopPropagation()}>
        <h3>Create New Role</h3>
        <div className="form-group">
          <label>Role Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Developer"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe what this role can do"
            rows={3}
          />
        </div>
        <div className="form-group">
          <label>Permissions</label>
          <div className="permission-checkboxes">
            {Object.entries(groupedPermissions).map(([resource, perms]) => (
              <div key={resource} className="permission-resource-group">
                <h4>{resource.charAt(0).toUpperCase() + resource.slice(1)}</h4>
                {perms.map(perm => (
                  <label key={perm.id}>
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                    />
                    <span>
                      <strong>{perm.action}</strong> - {perm.description}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={handleSubmit}>Create Role</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default RBACSettings;
