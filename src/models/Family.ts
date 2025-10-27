import database from '../config/database';
import { IFamily } from '../types';
import { ApiError } from '../utils/apiError';

export class FamilyModel {
  /**
   * Find family by ID
   */
  public static async findById(familyId: number): Promise<IFamily | null> {
    const result = await database.executeQuery<IFamily>(
      `SELECT * FROM families WHERE family_id = @familyId`,
      { familyId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Find all families by parish ID
   */
  public static async findByParishId(parishId: number, page: number = 1, limit: number = 20): Promise<IFamily[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IFamily>(
      `SELECT * FROM families
       WHERE parish_id = @parishId AND is_active = 1
       ORDER BY family_name ASC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishId, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Find all families by ward ID
   */
  public static async findByWardId(wardId: number, page: number = 1, limit: number = 20): Promise<IFamily[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IFamily>(
      `SELECT * FROM families
       WHERE ward_id = @wardId AND is_active = 1
       ORDER BY family_name ASC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { wardId, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Get all families for a parish (no pagination)
   */
  public static async getAllByParish(parishId: number): Promise<IFamily[]> {
    const result = await database.executeQuery<IFamily>(
      `SELECT * FROM families WHERE parish_id = @parishId AND is_active = 1 ORDER BY family_name ASC`,
      { parishId }
    );

    return result.recordset;
  }

  /**
   * Count families by parish ID
   */
  public static async countByParishId(parishId: number): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM families WHERE parish_id = @parishId AND is_active = 1`,
      { parishId }
    );

    return result.recordset[0].count;
  }

  /**
   * Count families by ward ID
   */
  public static async countByWardId(wardId: number): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM families WHERE ward_id = @wardId AND is_active = 1`,
      { wardId }
    );

    return result.recordset[0].count;
  }

  /**
   * Create a new family
   */
  public static async create(familyData: {
    parish_id: number;
    ward_id?: number;
    family_name: string;
    primary_contact_id?: number;
    head_of_family?: string;
    home_phone?: string;
    registration_date?: Date;
  }): Promise<IFamily> {
    console.log(familyData.head_of_family,"familyData")
    // Build dynamic INSERT query
    const fields: string[] = ['parish_id', 'family_name'];
    const params: Record<string, any> = {
      parish_id: familyData.parish_id,
      family_name: familyData.family_name,
    };

    // Add optional fields
    if (familyData.ward_id !== undefined) {
      fields.push('ward_id');
      params.ward_id = familyData.ward_id;
    }
    if (familyData.primary_contact_id !== undefined) {
      fields.push('primary_contact_id');
      params.primary_contact_id = familyData.primary_contact_id;
    }
    if (familyData.head_of_family !== undefined) {
      fields.push('head_of_family');
      params.head_of_family = familyData.head_of_family;
    }
    if (familyData.home_phone !== undefined) {
      fields.push('home_phone');
      params.home_phone = familyData.home_phone;
    }
    if (familyData.registration_date !== undefined) {
      fields.push('registration_date');
      params.registration_date = familyData.registration_date;
    }
    const fieldNames = fields.join(', ');
    const fieldParams = fields.map((f) => `@${f}`).join(', ');
    console.log(fieldParams,"params")

    const result = await database.executeQuery<{ family_id: number }>(
      `INSERT INTO families (${fieldNames})
       OUTPUT INSERTED.family_id
       VALUES (${fieldParams})`,
      params
    );

    const familyId = result.recordset[0].family_id;
    const family = await this.findById(familyId);

    if (!family) {
      throw ApiError.internal('Failed to create family');
    }

    return family;
  }

  /**
   * Update family
   */
  public static async update(
    familyId: number,
    updates: Partial<Omit<IFamily, 'family_id' | 'parish_id' | 'created_at' | 'updated_at'>>
  ): Promise<IFamily> {
    const existingFamily = await this.findById(familyId);
    if (!existingFamily) {
      throw ApiError.notFound('Family not found');
    }

    const updateFields: string[] = [];
    const params: Record<string, any> = { familyId };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return existingFamily;
    }

    await database.executeQuery(
      `UPDATE families SET ${updateFields.join(', ')}, updated_at = GETDATE()
       WHERE family_id = @familyId`,
      params
    );

    const updatedFamily = await this.findById(familyId);
    if (!updatedFamily) {
      throw ApiError.internal('Failed to update family');
    }

    return updatedFamily;
  }

  /**
   * Delete family (soft delete)
   */
  public static async delete(familyId: number): Promise<void> {
    const family = await this.findById(familyId);
    if (!family) {
      throw ApiError.notFound('Family not found');
    }

    await database.executeQuery(
      `UPDATE families SET is_active = 0, updated_at = GETDATE() WHERE family_id = @familyId`,
      { familyId }
    );
  }

  /**
   * Search families by name within a parish
   */
  public static async search(parishId: number, searchTerm: string): Promise<IFamily[]> {
    const result = await database.executeQuery<IFamily>(
      `SELECT * FROM families
       WHERE parish_id = @parishId AND is_active = 1 AND (
         family_name LIKE '%' + @searchTerm + '%' OR
         head_of_family LIKE '%' + @searchTerm + '%'
       )
       ORDER BY family_name ASC`,
      { parishId, searchTerm }
    );

    return result.recordset;
  }
}

export default FamilyModel;