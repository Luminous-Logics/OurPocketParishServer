/* eslint-disable @typescript-eslint/no-explicit-any */
import database from '../config/database';
import { IParish } from '../types';
import { ApiError } from '../utils/apiError';

export class ParishModel {
  /**
   * Find parish by ID
   */
  public static async findById(parishId: number): Promise<IParish | null> {
    const result = await database.executeQuery<IParish>(
      `SELECT * FROM parishes WHERE parish_id = @parishId`,
      { parishId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Get all parishes
   */
  public static async findAll(page: number = 1, limit: number = 20): Promise<IParish[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IParish>(
      `SELECT * FROM parishes
       WHERE is_active = 1
       ORDER BY parish_name ASC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { offset, limit }
    );

    return result.recordset;
  }

  /**
   * Create a new parish
   */
  public static async create(parishData: {
    parish_name: string;
    diocese?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    phone?: string;
    email?: string;
    website_url?: string;
    established_date?: Date;
    patron_saint?: string;
    timezone?: string;
    subscription_plan?: string;
    subscription_expiry?: Date;
  }): Promise<IParish> {
    const result = await database.executeQuery<{ parish_id: number }>(
      `INSERT INTO parishes (
        parish_name, diocese, address_line1, address_line2, city, state, country,
        postal_code, phone, email, website_url, established_date, patron_saint,
        timezone, subscription_plan, subscription_expiry
      )
       OUTPUT INSERTED.parish_id
       VALUES (
        @parish_name, @diocese, @address_line1, @address_line2, @city, @state, @country,
        @postal_code, @phone, @email, @website_url, @established_date, @patron_saint,
        @timezone, @subscription_plan, @subscription_expiry
      )`,
      parishData
    );

    const parishId = result.recordset[0].parish_id;
    const parish = await this.findById(parishId);

    if (!parish) {
      throw ApiError.internal('Failed to create parish');
    }

    return parish;
  }

  /**
   * Update parish
   */
  public static async update(
    parishId: number,
    updates: Partial<Omit<IParish, 'parish_id' | 'created_at' | 'updated_at'>>
  ): Promise<IParish> {
    const existingParish = await this.findById(parishId);
    if (!existingParish) {
      throw ApiError.notFound('Parish not found');
    }

    const updateFields: string[] = [];
    const params: Record<string, any> = { parishId };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return existingParish;
    }

    await database.executeQuery(
      `UPDATE parishes SET ${updateFields.join(', ')}, updated_at = GETDATE()
       WHERE parish_id = @parishId`,
      params
    );

    const updatedParish = await this.findById(parishId);
    if (!updatedParish) {
      throw ApiError.internal('Failed to update parish');
    }

    return updatedParish;
  }

  /**
   * Delete parish (soft delete)
   */
  public static async delete(parishId: number): Promise<void> {
    const parish = await this.findById(parishId);
    if (!parish) {
      throw ApiError.notFound('Parish not found');
    }

    await database.executeQuery(
      `UPDATE parishes SET is_active = 0, updated_at = GETDATE() WHERE parish_id = @parishId`,
      { parishId }
    );
  }

  /**
   * Count all parishes
   */
  public static async count(): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM parishes WHERE is_active = 1`
    );

    return result.recordset[0].count;
  }

  /**
   * Search parishes by name
   */
  public static async search(searchTerm: string): Promise<IParish[]> {
    const result = await database.executeQuery<IParish>(
      `SELECT * FROM parishes
       WHERE is_active = 1 AND (
         parish_name LIKE '%' + @searchTerm + '%' OR
         city LIKE '%' + @searchTerm + '%' OR
         state LIKE '%' + @searchTerm + '%'
       )
       ORDER BY parish_name ASC`,
      { searchTerm }
    );

    return result.recordset;
  }
}

export default ParishModel;
