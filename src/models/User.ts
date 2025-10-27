/* eslint-disable @typescript-eslint/no-explicit-any */
import database from '../config/database';
import { IUser, UserType } from '../types';
import { ApiError } from '../utils/apiError';

export class UserModel {
  /**
   * Find user by ID
   */
  public static async findById(userId: number): Promise<IUser | null> {
    const result = await database.executeQuery<IUser>(
      `SELECT * FROM users WHERE user_id = @userId`,
      { userId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Find user by email
   */
  public static async findByEmail(email: string): Promise<IUser | null> {
    const result = await database.executeQuery<IUser>(
      `SELECT * FROM users WHERE email = @email`,
      { email }
    );

    return result.recordset[0] || null;
  }

  /**
   * Create a new user
   */
  public static async create(userData: {
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    phone?: string;
    profile_image_url?: string;
    user_type: UserType;
  }): Promise<IUser> {
    // Check if email already exists
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw ApiError.conflict('Email already exists');
    }

    const result = await database.executeQuery<{ user_id: number }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, profile_image_url, user_type)
       OUTPUT INSERTED.user_id
       VALUES (@email, @password_hash, @first_name, @last_name, @phone, @profile_image_url, @user_type)`,
      userData
    );

    const userId = result.recordset[0].user_id;
    const user = await this.findById(userId);

    if (!user) {
      throw ApiError.internal('Failed to create user');
    }

    return user;
  }

  /**
   * Update user
   */
  public static async update(
    userId: number,
    updates: Partial<Omit<IUser, 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<IUser> {
    const existingUser = await this.findById(userId);
    if (!existingUser) {
      throw ApiError.notFound('User not found');
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const params: Record<string, any> = { userId };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return existingUser;
    }

    await database.executeQuery(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = GETDATE()
       WHERE user_id = @userId`,
      params
    );

    const updatedUser = await this.findById(userId);
    if (!updatedUser) {
      throw ApiError.internal('Failed to update user');
    }

    return updatedUser;
  }

  /**
   * Delete user (soft delete by setting is_active = 0)
   */
  public static async delete(userId: number): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    await database.executeQuery(
      `UPDATE users SET is_active = 0, updated_at = GETDATE() WHERE user_id = @userId`,
      { userId }
    );
  }

  /**
   * Update last login timestamp
   */
  public static async updateLastLogin(userId: number): Promise<void> {
    await database.executeQuery(
      `UPDATE users SET last_login = GETDATE() WHERE user_id = @userId`,
      { userId }
    );
  }

  /**
   * Verify email
   */
  public static async verifyEmail(userId: number): Promise<void> {
    await database.executeQuery(
      `UPDATE users SET email_verified = 1, updated_at = GETDATE() WHERE user_id = @userId`,
      { userId }
    );
  }

  /**
   * Get all users by type
   */
  public static async findByUserType(
    userType: UserType,
    page: number = 1,
    limit: number = 20
  ): Promise<IUser[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IUser>(
      `SELECT * FROM users
       WHERE user_type = @userType AND is_active = 1
       ORDER BY created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { userType, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Count users by type
   */
  public static async countByUserType(userType: UserType): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM users WHERE user_type = @userType AND is_active = 1`,
      { userType }
    );

    return result.recordset[0].count;
  }
}

export default UserModel;
