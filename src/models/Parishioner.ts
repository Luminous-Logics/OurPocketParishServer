import database from '../config/database';
import { IParishioner } from '../types';
import { ApiError } from '../utils/apiError';

export class ParishionerModel {
  /**
   * Find parishioner by ID
   */
  public static async findById(parishionerId: number): Promise<IParishioner | null> {
    const result = await database.executeQuery<IParishioner>(
      `SELECT
         p.*,
         u.first_name,
         u.last_name,
         u.email,
         u.phone
       FROM parishioners p
       INNER JOIN users u ON p.user_id = u.user_id
       WHERE p.parishioner_id = @parishionerId`,
      { parishionerId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Find parishioner by user ID
   */
  public static async findByUserId(userId: number): Promise<IParishioner | null> {
    const result = await database.executeQuery<IParishioner>(
      `SELECT
         p.*,
         u.first_name,
         u.last_name,
         u.email,
         u.phone
       FROM parishioners p
       INNER JOIN users u ON p.user_id = u.user_id
       WHERE p.user_id = @userId`,
      { userId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Find all parishioners by parish ID with pagination
   */
  public static async findByParishId(parishId: number, page: number = 1, limit: number = 20): Promise<IParishioner[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IParishioner>(
      `SELECT
         p.*,
         u.first_name,
         u.last_name,
         u.email,
         u.phone
       FROM parishioners p
       INNER JOIN users u ON p.user_id = u.user_id
       WHERE p.parish_id = @parishId AND p.is_active = 1
       ORDER BY p.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishId, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Find all parishioners by ward ID with pagination
   */
  public static async findByWardId(wardId: number, page: number = 1, limit: number = 20): Promise<IParishioner[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IParishioner>(
      `SELECT
         p.*,
         u.first_name,
         u.last_name,
         u.email,
         u.phone
       FROM parishioners p
       INNER JOIN users u ON p.user_id = u.user_id
       WHERE p.ward_id = @wardId AND p.is_active = 1
       ORDER BY p.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { wardId, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Find all parishioners by family ID
   */
  public static async findByFamilyId(familyId: number): Promise<IParishioner[]> {
    const result = await database.executeQuery<IParishioner>(
      `SELECT
         p.*,
         u.first_name,
         u.last_name,
         u.email,
         u.phone
       FROM parishioners p
       INNER JOIN users u ON p.user_id = u.user_id
       WHERE p.family_id = @familyId AND p.is_active = 1
       ORDER BY p.date_of_birth ASC`,
      { familyId }
    );

    return result.recordset;
  }

  /**
   * Count parishioners by parish ID
   */
  public static async countByParishId(parishId: number): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM parishioners WHERE parish_id = @parishId AND is_active = 1`,
      { parishId }
    );

    return result.recordset[0].count;
  }

  /**
   * Count parishioners by ward ID
   */
  public static async countByWardId(wardId: number): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM parishioners WHERE ward_id = @wardId AND is_active = 1`,
      { wardId }
    );

    return result.recordset[0].count;
  }

  /**
   * Get all parishioners for a parish (no pagination)
   */
  public static async getAllByParish(parishId: number): Promise<IParishioner[]> {
    const result = await database.executeQuery<IParishioner>(
      `SELECT
         p.*,
         u.first_name,
         u.last_name,
         u.email,
         u.phone
       FROM parishioners p
       INNER JOIN users u ON p.user_id = u.user_id
       WHERE p.parish_id = @parishId AND p.is_active = 1
       ORDER BY p.created_at DESC`,
      { parishId }
    );

    return result.recordset;
  }

  /**
   * Create a new parishioner
   */
  public static async create(parishionerData: {
    user_id: number;
    parish_id: number;
    ward_id?: number;
    family_id?: number;
    middle_name?: string;
    date_of_birth?: Date;
    gender?: string;
    marital_status?: string;
    occupation?: string;
    baptism_date?: Date;
    first_communion_date?: Date;
    confirmation_date?: Date;
    marriage_date?: Date;
    member_status?: string;
    photo_url?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    notes?: string;
    registration_date?: Date;
  }): Promise<IParishioner> {
    // Build dynamic INSERT query
    const fields: string[] = ['user_id', 'parish_id'];
    const params: Record<string, any> = {
      user_id: parishionerData.user_id,
      parish_id: parishionerData.parish_id,
    };

    // Add optional fields
    if (parishionerData.ward_id !== undefined) {
      fields.push('ward_id');
      params.ward_id = parishionerData.ward_id;
    }
    if (parishionerData.family_id !== undefined) {
      fields.push('family_id');
      params.family_id = parishionerData.family_id;
    }
    if (parishionerData.middle_name !== undefined) {
      fields.push('middle_name');
      params.middle_name = parishionerData.middle_name;
    }
    if (parishionerData.date_of_birth !== undefined) {
      fields.push('date_of_birth');
      params.date_of_birth = parishionerData.date_of_birth;
    }
    if (parishionerData.gender !== undefined) {
      fields.push('gender');
      params.gender = parishionerData.gender;
    }
    if (parishionerData.marital_status !== undefined) {
      fields.push('marital_status');
      params.marital_status = parishionerData.marital_status;
    }
    if (parishionerData.occupation !== undefined) {
      fields.push('occupation');
      params.occupation = parishionerData.occupation;
    }
    if (parishionerData.baptism_date !== undefined) {
      fields.push('baptism_date');
      params.baptism_date = parishionerData.baptism_date;
    }
    if (parishionerData.first_communion_date !== undefined) {
      fields.push('first_communion_date');
      params.first_communion_date = parishionerData.first_communion_date;
    }
    if (parishionerData.confirmation_date !== undefined) {
      fields.push('confirmation_date');
      params.confirmation_date = parishionerData.confirmation_date;
    }
    if (parishionerData.marriage_date !== undefined) {
      fields.push('marriage_date');
      params.marriage_date = parishionerData.marriage_date;
    }
    if (parishionerData.member_status !== undefined) {
      fields.push('member_status');
      params.member_status = parishionerData.member_status;
    }
    if (parishionerData.photo_url !== undefined) {
      fields.push('photo_url');
      params.photo_url = parishionerData.photo_url;
    }
    if (parishionerData.address_line1 !== undefined) {
      fields.push('address_line1');
      params.address_line1 = parishionerData.address_line1;
    }
    if (parishionerData.address_line2 !== undefined) {
      fields.push('address_line2');
      params.address_line2 = parishionerData.address_line2;
    }
    if (parishionerData.city !== undefined) {
      fields.push('city');
      params.city = parishionerData.city;
    }
    if (parishionerData.state !== undefined) {
      fields.push('state');
      params.state = parishionerData.state;
    }
    if (parishionerData.country !== undefined) {
      fields.push('country');
      params.country = parishionerData.country;
    }
    if (parishionerData.postal_code !== undefined) {
      fields.push('postal_code');
      params.postal_code = parishionerData.postal_code;
    }
    if (parishionerData.emergency_contact_name !== undefined) {
      fields.push('emergency_contact_name');
      params.emergency_contact_name = parishionerData.emergency_contact_name;
    }
    if (parishionerData.emergency_contact_phone !== undefined) {
      fields.push('emergency_contact_phone');
      params.emergency_contact_phone = parishionerData.emergency_contact_phone;
    }
    if (parishionerData.notes !== undefined) {
      fields.push('notes');
      params.notes = parishionerData.notes;
    }
    if (parishionerData.registration_date !== undefined) {
      fields.push('registration_date');
      params.registration_date = parishionerData.registration_date;
    }

    const fieldNames = fields.join(', ');
    const fieldParams = fields.map((f) => `@${f}`).join(', ');

    const result = await database.executeQuery<{ parishioner_id: number }>(
      `INSERT INTO parishioners (${fieldNames})
       OUTPUT INSERTED.parishioner_id
       VALUES (${fieldParams})`,
      params
    );

    const parishionerId = result.recordset[0].parishioner_id;
    const parishioner = await this.findById(parishionerId);

    if (!parishioner) {
      throw ApiError.internal('Failed to create parishioner');
    }

    return parishioner;
  }

  /**
   * Update parishioner
   */
  public static async update(
    parishionerId: number,
    updates: Partial<Omit<IParishioner, 'parishioner_id' | 'user_id' | 'parish_id' | 'created_at' | 'updated_at'>>
  ): Promise<IParishioner> {
    const existingParishioner = await this.findById(parishionerId);
    if (!existingParishioner) {
      throw ApiError.notFound('Parishioner not found');
    }

    const updateFields: string[] = [];
    const params: Record<string, any> = { parishionerId };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return existingParishioner;
    }

    await database.executeQuery(
      `UPDATE parishioners SET ${updateFields.join(', ')}, updated_at = GETDATE()
       WHERE parishioner_id = @parishionerId`,
      params
    );

    const updatedParishioner = await this.findById(parishionerId);
    if (!updatedParishioner) {
      throw ApiError.internal('Failed to update parishioner');
    }

    return updatedParishioner;
  }

  /**
   * Delete parishioner (soft delete)
   */
  public static async delete(parishionerId: number): Promise<void> {
    const parishioner = await this.findById(parishionerId);
    if (!parishioner) {
      throw ApiError.notFound('Parishioner not found');
    }

    await database.executeQuery(
      `UPDATE parishioners SET is_active = 0, updated_at = GETDATE() WHERE parishioner_id = @parishionerId`,
      { parishionerId }
    );
  }

  /**
   * Search parishioners by name within a parish
   */
  public static async search(parishId: number, searchTerm: string): Promise<IParishioner[]> {
    const result = await database.executeQuery<IParishioner>(
      `SELECT p.* FROM parishioners p
       INNER JOIN users u ON p.user_id = u.user_id
       WHERE p.parish_id = @parishId AND p.is_active = 1 AND (
         u.first_name LIKE '%' + @searchTerm + '%' OR
         u.last_name LIKE '%' + @searchTerm + '%' OR
         u.email LIKE '%' + @searchTerm + '%' OR
         p.middle_name LIKE '%' + @searchTerm + '%'
       )
       ORDER BY u.first_name, u.last_name ASC`,
      { parishId, searchTerm }
    );

    return result.recordset;
  }
}

export default ParishionerModel;
