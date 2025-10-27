import database from '../config/database';
import sql from 'mssql';

export interface IRole {
  role_id: number;
  parish_id?: number;
  role_name: string;
  role_code: string;
  description?: string;
  is_system_role: boolean;
  is_active: boolean;
  priority: number;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface IPermission {
  permission_id: number;
  permission_name: string;
  permission_code: string;
  description?: string;
  module: string;
  action: string;
  is_active: boolean;
  created_at: Date;
}

export interface IRolePermission {
  role_permission_id: number;
  role_id: number;
  permission_id: number;
  granted_by?: number;
  granted_at: Date;
}

export interface IUserRole {
  user_role_id: number;
  user_id: number;
  role_id: number;
  assigned_by?: number;
  assigned_at: Date;
  expires_at?: Date;
  is_active: boolean;
}

export interface IUserPermission {
  user_permission_id: number;
  user_id: number;
  permission_id: number;
  permission_type: 'GRANT' | 'REVOKE';
  assigned_by?: number;
  assigned_at: Date;
  expires_at?: Date;
  reason?: string;
  is_active: boolean;
}

export interface IPermissionAuditLog {
  audit_id: number;
  action_type: string;
  entity_type: string;
  entity_id?: number;
  performed_by?: number;
  performed_at: Date;
  old_value?: string;
  new_value?: string;
  description?: string;
  ip_address?: string;
}

export class RoleModel {
  /**
   * Get all roles (optionally filtered by parish)
   */
  public static async getAllRoles(parishId?: number): Promise<IRole[]> {
    const request = database.getPool().request();

    let query = `
      SELECT role_id, parish_id, role_name, role_code, description,
             is_system_role, is_active, priority, created_by, created_at, updated_at
      FROM roles
      WHERE is_active = 1
    `;

    if (parishId) {
      query += ' AND (parish_id = @parishId OR parish_id IS NULL)';
      request.input('parishId', sql.BigInt, parishId);
    } else {
      query += ' AND parish_id IS NULL';
    }

    query += ' ORDER BY priority DESC, role_name ASC';

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Get role by ID
   */
  public static async getRoleById(roleId: number): Promise<IRole | null> {
    const result = await database.getPool().request()
      .input('roleId', sql.BigInt, roleId)
      .query(`
        SELECT role_id, parish_id, role_name, role_code, description,
               is_system_role, is_active, priority, created_by, created_at, updated_at
        FROM roles
        WHERE role_id = @roleId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Get role by code
   */
  public static async getRoleByCode(roleCode: string, parishId?: number): Promise<IRole | null> {
    const request = database.getPool().request()
      .input('roleCode', sql.VarChar(50), roleCode);

    let query = 'SELECT * FROM roles WHERE role_code = @roleCode';

    if (parishId) {
      query += ' AND (parish_id = @parishId OR parish_id IS NULL)';
      request.input('parishId', sql.BigInt, parishId);
    } else {
      query += ' AND parish_id IS NULL';
    }

    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Create a new role
   */
  public static async createRole(roleData: Partial<IRole>): Promise<IRole> {
    const result = await database.getPool().request()
      .input('parishId', sql.BigInt, roleData.parish_id || null)
      .input('roleName', sql.VarChar(100), roleData.role_name)
      .input('roleCode', sql.VarChar(50), roleData.role_code)
      .input('description', sql.Text, roleData.description || null)
      .input('isSystemRole', sql.Bit, roleData.is_system_role || 0)
      .input('priority', sql.Int, roleData.priority || 0)
      .input('createdBy', sql.BigInt, roleData.created_by || null)
      .query(`
        INSERT INTO roles (parish_id, role_name, role_code, description, is_system_role, priority, created_by)
        OUTPUT INSERTED.*
        VALUES (@parishId, @roleName, @roleCode, @description, @isSystemRole, @priority, @createdBy)
      `);

    return result.recordset[0];
  }

  /**
   * Update role
   */
  public static async updateRole(roleId: number, roleData: Partial<IRole>): Promise<IRole> {
    const result = await database.getPool().request()
      .input('roleId', sql.BigInt, roleId)
      .input('roleName', sql.VarChar(100), roleData.role_name)
      .input('description', sql.Text, roleData.description || null)
      .input('priority', sql.Int, roleData.priority)
      .input('isActive', sql.Bit, roleData.is_active)
      .query(`
        UPDATE roles
        SET role_name = @roleName,
            description = @description,
            priority = @priority,
            is_active = @isActive,
            updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE role_id = @roleId
      `);

    return result.recordset[0];
  }

  /**
   * Delete role (soft delete)
   */
  public static async deleteRole(roleId: number): Promise<void> {
    await database.getPool().request()
      .input('roleId', sql.BigInt, roleId)
      .query(`
        UPDATE roles
        SET is_active = 0, updated_at = GETDATE()
        WHERE role_id = @roleId AND is_system_role = 0
      `);
  }

  /**
   * Get permissions for a role
   */
  public static async getRolePermissions(roleId: number): Promise<IPermission[]> {
    const result = await database.getPool().request()
      .input('roleId', sql.BigInt, roleId)
      .query(`
        SELECT p.*
        FROM permissions p
        INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
        WHERE rp.role_id = @roleId AND p.is_active = 1
        ORDER BY p.module, p.action
      `);

    return result.recordset;
  }

  /**
   * Assign permission to role
   */
  public static async assignPermissionToRole(
    roleId: number,
    permissionId: number,
    grantedBy?: number
  ): Promise<IRolePermission> {
    const result = await database.getPool().request()
      .input('roleId', sql.BigInt, roleId)
      .input('permissionId', sql.BigInt, permissionId)
      .input('grantedBy', sql.BigInt, grantedBy || null)
      .query(`
        INSERT INTO role_permissions (role_id, permission_id, granted_by)
        OUTPUT INSERTED.*
        VALUES (@roleId, @permissionId, @grantedBy)
      `);

    return result.recordset[0];
  }

  /**
   * Remove permission from role
   */
  public static async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    await database.getPool().request()
      .input('roleId', sql.BigInt, roleId)
      .input('permissionId', sql.BigInt, permissionId)
      .query('DELETE FROM role_permissions WHERE role_id = @roleId AND permission_id = @permissionId');
  }

  /**
   * Get all users with a specific role
   */
  public static async getUsersByRole(roleId: number): Promise<any[]> {
    const result = await database.getPool().request()
      .input('roleId', sql.BigInt, roleId)
      .query(`
        SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone,
               ur.assigned_at, ur.expires_at, ur.is_active
        FROM users u
        INNER JOIN user_roles ur ON u.user_id = ur.user_id
        WHERE ur.role_id = @roleId AND ur.is_active = 1
        ORDER BY u.first_name, u.last_name
      `);

    return result.recordset;
  }
}

export class PermissionModel {
  /**
   * Get all permissions
   */
  public static async getAllPermissions(): Promise<IPermission[]> {
    const result = await database.getPool().request()
      .query(`
        SELECT * FROM permissions
        WHERE is_active = 1
        ORDER BY module, action
      `);

    return result.recordset;
  }

  /**
   * Get permissions by module
   */
  public static async getPermissionsByModule(module: string): Promise<IPermission[]> {
    const result = await database.getPool().request()
      .input('module', sql.VarChar(50), module)
      .query(`
        SELECT * FROM permissions
        WHERE module = @module AND is_active = 1
        ORDER BY action
      `);

    return result.recordset;
  }

  /**
   * Get permission by code
   */
  public static async getPermissionByCode(permissionCode: string): Promise<IPermission | null> {
    const result = await database.getPool().request()
      .input('permissionCode', sql.VarChar(100), permissionCode)
      .query('SELECT * FROM permissions WHERE permission_code = @permissionCode');

    return result.recordset[0] || null;
  }

  /**
   * Create custom permission (if needed)
   */
  public static async createPermission(permissionData: Partial<IPermission>): Promise<IPermission> {
    const result = await database.getPool().request()
      .input('permissionName', sql.VarChar(100), permissionData.permission_name)
      .input('permissionCode', sql.VarChar(100), permissionData.permission_code)
      .input('description', sql.Text, permissionData.description || null)
      .input('module', sql.VarChar(50), permissionData.module)
      .input('action', sql.VarChar(50), permissionData.action)
      .query(`
        INSERT INTO permissions (permission_name, permission_code, description, module, action)
        OUTPUT INSERTED.*
        VALUES (@permissionName, @permissionCode, @description, @module, @action)
      `);

    return result.recordset[0];
  }

  /**
   * Get user's effective permissions (from roles + direct permissions)
   *
   * FIXED: Changed to use DISTINCT on permission_id only (TEXT columns can't be in DISTINCT)
   */
  public static async getUserPermissions(userId: number): Promise<IPermission[]> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .query(`
        -- Get permissions from user roles and direct grants, exclude revokes
        SELECT DISTINCT
          p.permission_id,
          p.permission_name,
          p.permission_code,
          CAST(p.description AS VARCHAR(MAX)) AS description,
          p.module,
          p.action,
          p.is_active,
          p.created_at
        FROM permissions p
        WHERE p.is_active = 1
          AND p.permission_id IN (
            -- Permissions from roles
            SELECT rp.permission_id
            FROM role_permissions rp
            INNER JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = @userId
              AND ur.is_active = 1
              AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE())

            UNION

            -- Directly granted permissions
            SELECT up.permission_id
            FROM user_permissions up
            WHERE up.user_id = @userId
              AND up.permission_type = 'GRANT'
              AND up.is_active = 1
              AND (up.expires_at IS NULL OR up.expires_at > GETDATE())
          )
          AND p.permission_id NOT IN (
            -- Exclude revoked permissions
            SELECT up.permission_id
            FROM user_permissions up
            WHERE up.user_id = @userId
              AND up.permission_type = 'REVOKE'
              AND up.is_active = 1
              AND (up.expires_at IS NULL OR up.expires_at > GETDATE())
          )
        ORDER BY p.module, p.action
      `);

    return result.recordset;
  }

  /**
   * Check if user has specific permission
   */
  public static async userHasPermission(userId: number, permissionCode: string): Promise<boolean> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('permissionCode', sql.VarChar(100), permissionCode)
      .query(`
        SELECT CASE
          WHEN EXISTS (
            -- Check if permission is granted via role
            SELECT 1
            FROM permissions p
            INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
            INNER JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = @userId
              AND p.permission_code = @permissionCode
              AND ur.is_active = 1
              AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE())
              AND p.is_active = 1
          )
          OR EXISTS (
            -- Check if directly granted
            SELECT 1
            FROM permissions p
            INNER JOIN user_permissions up ON p.permission_id = up.permission_id
            WHERE up.user_id = @userId
              AND p.permission_code = @permissionCode
              AND up.permission_type = 'GRANT'
              AND up.is_active = 1
              AND (up.expires_at IS NULL OR up.expires_at > GETDATE())
          )
          THEN CAST(1 AS BIT)
          ELSE CAST(0 AS BIT)
        END AS has_permission
      `);

    return result.recordset[0]?.has_permission || false;
  }
}

export class UserRoleModel {
  /**
   * Get user's roles
   */
  public static async getUserRoles(userId: number): Promise<IRole[]> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .query(`
        SELECT r.*
        FROM roles r
        INNER JOIN user_roles ur ON r.role_id = ur.role_id
        WHERE ur.user_id = @userId
          AND ur.is_active = 1
          AND (ur.expires_at IS NULL OR ur.expires_at > GETDATE())
        ORDER BY r.priority DESC
      `);

    return result.recordset;
  }

  /**
   * Assign role to user
   */
  public static async assignRoleToUser(
    userId: number,
    roleId: number,
    assignedBy?: number,
    expiresAt?: Date
  ): Promise<IUserRole> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('roleId', sql.BigInt, roleId)
      .input('assignedBy', sql.BigInt, assignedBy || null)
      .input('expiresAt', sql.DateTime2, expiresAt || null)
      .query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
        OUTPUT INSERTED.*
        VALUES (@userId, @roleId, @assignedBy, @expiresAt)
      `);

    return result.recordset[0];
  }

  /**
   * Remove role from user
   */
  public static async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('roleId', sql.BigInt, roleId)
      .query('DELETE FROM user_roles WHERE user_id = @userId AND role_id = @roleId');
  }

  /**
   * Grant direct permission to user
   */
  public static async grantPermissionToUser(
    userId: number,
    permissionId: number,
    assignedBy?: number,
    reason?: string,
    expiresAt?: Date
  ): Promise<IUserPermission> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('permissionId', sql.BigInt, permissionId)
      .input('assignedBy', sql.BigInt, assignedBy || null)
      .input('reason', sql.Text, reason || null)
      .input('expiresAt', sql.DateTime2, expiresAt || null)
      .query(`
        MERGE user_permissions AS target
        USING (SELECT @userId AS user_id, @permissionId AS permission_id) AS source
        ON target.user_id = source.user_id AND target.permission_id = source.permission_id
        WHEN MATCHED THEN
          UPDATE SET permission_type = 'GRANT', is_active = 1, assigned_by = @assignedBy,
                     reason = @reason, expires_at = @expiresAt, assigned_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, permission_id, permission_type, assigned_by, reason, expires_at)
          VALUES (@userId, @permissionId, 'GRANT', @assignedBy, @reason, @expiresAt)
        OUTPUT INSERTED.*;
      `);

    return result.recordset[0];
  }

  /**
   * Revoke permission from user
   */
  public static async revokePermissionFromUser(
    userId: number,
    permissionId: number,
    assignedBy?: number,
    reason?: string
  ): Promise<void> {
    await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('permissionId', sql.BigInt, permissionId)
      .input('assignedBy', sql.BigInt, assignedBy || null)
      .input('reason', sql.Text, reason || null)
      .query(`
        MERGE user_permissions AS target
        USING (SELECT @userId AS user_id, @permissionId AS permission_id) AS source
        ON target.user_id = source.user_id AND target.permission_id = source.permission_id
        WHEN MATCHED THEN
          UPDATE SET permission_type = 'REVOKE', is_active = 1, assigned_by = @assignedBy,
                     reason = @reason, assigned_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, permission_id, permission_type, assigned_by, reason)
          VALUES (@userId, @permissionId, 'REVOKE', @assignedBy, @reason);
      `);
  }
}

export default {
  RoleModel,
  PermissionModel,
  UserRoleModel,
};
