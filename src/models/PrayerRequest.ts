import database from '../config/database';
import { IPrayerRequest } from '../types';
import { ApiError } from '../utils/apiError';

export class PrayerRequestModel {
  /**
   * Get church_admin_id from user_id
   */
  public static async getChurchAdminId(userId: number): Promise<number | undefined> {
    const result = await database.executeQuery<{ church_admin_id: number }>(
      `SELECT church_admin_id FROM church_admins WHERE user_id = @userId AND is_active = 1`,
      { userId }
    );

    return result.recordset[0]?.church_admin_id;
  }

  /**
   * Find prayer request by ID
   */
  public static async findById(prayerRequestId: number): Promise<IPrayerRequest | null> {
    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests WHERE prayer_request_id = @prayerRequestId`,
      { prayerRequestId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Find all prayer requests by parish ID with pagination
   */
  public static async findByParishId(
    parishId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<IPrayerRequest[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE parish_id = @parishId
       ORDER BY booking_date DESC, booking_time DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishId, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Get active prayer requests (pending + confirmed)
   * For "Active/New" tab in UI
   */
  public static async getActiveRequests(parishId: number): Promise<IPrayerRequest[]> {
    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE parish_id = @parishId
         AND status IN ('pending', 'confirmed')
       ORDER BY booking_date DESC, created_at DESC`,
      { parishId }
    );

    return result.recordset;
  }

  /**
   * Get past prayer requests (completed + cancelled)
   * For "Past Requests" tab in UI
   */
  public static async getPastRequests(parishId: number): Promise<IPrayerRequest[]> {
    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE parish_id = @parishId
         AND status IN ('completed', 'cancelled')
       ORDER BY updated_at DESC`,
      { parishId }
    );

    return result.recordset;
  }

  /**
   * Count prayer requests by parish ID
   */
  public static async countByParishId(parishId: number): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM prayer_requests
       WHERE parish_id = @parishId`,
      { parishId }
    );

    return result.recordset[0].count;
  }

  /**
   * Get prayer requests by status
   */
  public static async findByStatus(
    parishId: number,
    status: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IPrayerRequest[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE parish_id = @parishId AND status = @status
       ORDER BY booking_date DESC, booking_time DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishId, status, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Get prayer requests by date
   */
  public static async findByDate(
    parishId: number,
    bookingDate: Date
  ): Promise<IPrayerRequest[]> {
    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE parish_id = @parishId AND booking_date = @bookingDate
       ORDER BY booking_time ASC`,
      { parishId, bookingDate }
    );

    return result.recordset;
  }

  /**
   * Get prayer requests by date range
   */
  public static async findByDateRange(
    parishId: number,
    startDate: Date,
    endDate: Date
  ): Promise<IPrayerRequest[]> {
    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE parish_id = @parishId
         AND booking_date >= @startDate
         AND booking_date <= @endDate
       ORDER BY booking_date ASC, booking_time ASC`,
      { parishId, startDate, endDate }
    );

    return result.recordset;
  }

  /**
   * Check if a time slot is available
   */
  public static async isSlotAvailable(
    parishId: number,
    bookingDate: Date,
    bookingTime: string,
    excludePrayerRequestId?: number
  ): Promise<boolean> {
    const params: Record<string, any> = {
      parishId,
      bookingDate,
      bookingTime,
    };

    let query = `
      SELECT COUNT(*) as count FROM prayer_requests
      WHERE parish_id = @parishId
        AND booking_date = @bookingDate
        AND booking_time = @bookingTime
        AND status IN ('pending', 'confirmed')
    `;

    if (excludePrayerRequestId) {
      query += ` AND prayer_request_id != @excludePrayerRequestId`;
      params.excludePrayerRequestId = excludePrayerRequestId;
    }

    const result = await database.executeQuery<{ count: number }>(query, params);

    return result.recordset[0].count === 0;
  }

  /**
   * Get prayer requests by parishioner
   */
  public static async findByParishioner(
    parishionerId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<IPrayerRequest[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE requested_by = @parishionerId
       ORDER BY booking_date DESC, booking_time DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishionerId, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Create a new prayer request (with optional booking)
   */
  public static async create(prayerRequestData: {
    parish_id: number;
    requested_by?: number;
    requester_name: string;
    subject: string;
    description: string;
    booking_date?: Date | null;
    booking_time?: string | null;
    is_anonymous?: boolean;
    is_urgent?: boolean;
    is_public?: boolean;
  }): Promise<IPrayerRequest> {
    // Check if slot is available (only if booking date and time are provided)
    if (prayerRequestData.booking_date && prayerRequestData.booking_time) {
      const isAvailable = await this.isSlotAvailable(
        prayerRequestData.parish_id,
        prayerRequestData.booking_date,
        prayerRequestData.booking_time
      );

      if (!isAvailable) {
        throw ApiError.conflict('This prayer slot is already booked. Please select a different time.');
      }
    }

    // Build dynamic INSERT query
    const fields: string[] = [
      'parish_id',
      'requester_name',
      'subject',
      'description',
    ];
    const params: Record<string, any> = {
      parish_id: prayerRequestData.parish_id,
      requester_name: prayerRequestData.requester_name,
      subject: prayerRequestData.subject,
      description: prayerRequestData.description,
    };

    // Add optional fields
    if (prayerRequestData.requested_by !== undefined) {
      fields.push('requested_by');
      params.requested_by = prayerRequestData.requested_by;
    }
    if (prayerRequestData.booking_date) {
      fields.push('booking_date');
      params.booking_date = prayerRequestData.booking_date;
    }
    if (prayerRequestData.booking_time) {
      fields.push('booking_time');
      params.booking_time = prayerRequestData.booking_time;
    }
    if (prayerRequestData.is_anonymous !== undefined) {
      fields.push('is_anonymous');
      params.is_anonymous = prayerRequestData.is_anonymous;
    }
    if (prayerRequestData.is_urgent !== undefined) {
      fields.push('is_urgent');
      params.is_urgent = prayerRequestData.is_urgent;
    }
    if (prayerRequestData.is_public !== undefined) {
      fields.push('is_public');
      params.is_public = prayerRequestData.is_public;
    }

    const fieldNames = fields.join(', ');
    const fieldParams = fields.map((f) => `@${f}`).join(', ');

    const result = await database.executeQuery<{ prayer_request_id: number }>(
      `INSERT INTO prayer_requests (${fieldNames})
       OUTPUT INSERTED.prayer_request_id
       VALUES (${fieldParams})`,
      params
    );

    const prayerRequestId = result.recordset[0].prayer_request_id;
    const prayerRequest = await this.findById(prayerRequestId);

    if (!prayerRequest) {
      throw ApiError.internal('Failed to create prayer request');
    }

    return prayerRequest;
  }

  /**
   * Update prayer request
   */
  public static async update(
    prayerRequestId: number,
    updates: Partial<Omit<IPrayerRequest, 'prayer_request_id' | 'parish_id' | 'created_at' | 'updated_at'>>
  ): Promise<IPrayerRequest> {
    const existingPrayerRequest = await this.findById(prayerRequestId);
    if (!existingPrayerRequest) {
      throw ApiError.notFound('Prayer request not found');
    }

    // If updating booking date/time, check availability
    if (updates.booking_date || updates.booking_time) {
      const checkDate = updates.booking_date || existingPrayerRequest.booking_date;
      const checkTime = updates.booking_time || existingPrayerRequest.booking_time;

      const isAvailable = await this.isSlotAvailable(
        existingPrayerRequest.parish_id,
        checkDate,
        checkTime,
        prayerRequestId
      );

      if (!isAvailable) {
        throw ApiError.conflict('This prayer slot is already booked. Please select a different time.');
      }
    }

    const updateFields: string[] = [];
    const params: Record<string, any> = { prayerRequestId };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return existingPrayerRequest;
    }

    await database.executeQuery(
      `UPDATE prayer_requests SET ${updateFields.join(', ')}, updated_at = GETDATE()
       WHERE prayer_request_id = @prayerRequestId`,
      params
    );

    const updatedPrayerRequest = await this.findById(prayerRequestId);
    if (!updatedPrayerRequest) {
      throw ApiError.internal('Failed to update prayer request');
    }

    return updatedPrayerRequest;
  }

  /**
   * Update status (approve, confirm, complete, cancel)
   */
  public static async updateStatus(
    prayerRequestId: number,
    status: string,
    approvedBy?: number,
    notes?: string
  ): Promise<IPrayerRequest> {
    const updates: any = { status };

    if (approvedBy !== undefined) {
      updates.approved_by = approvedBy;
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    return this.update(prayerRequestId, updates);
  }

  /**
   * Approve prayer request
   * Changes status from 'pending' to 'confirmed'
   */
  public static async approve(prayerRequestId: number, approvedBy?: number): Promise<IPrayerRequest> {
    return this.updateStatus(prayerRequestId, 'confirmed', approvedBy);
  }

  /**
   * Close prayer request
   * Changes status to 'completed'
   */
  public static async close(prayerRequestId: number): Promise<IPrayerRequest> {
    return this.updateStatus(prayerRequestId, 'completed');
  }

  /**
   * Delete prayer request (hard delete for this module)
   */
  public static async delete(prayerRequestId: number): Promise<void> {
    const prayerRequest = await this.findById(prayerRequestId);
    if (!prayerRequest) {
      throw ApiError.notFound('Prayer request not found');
    }

    await database.executeQuery(
      `DELETE FROM prayer_requests WHERE prayer_request_id = @prayerRequestId`,
      { prayerRequestId }
    );
  }

  /**
   * Search prayer requests by subject or description
   */
  public static async search(parishId: number, searchTerm: string): Promise<IPrayerRequest[]> {
    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT * FROM prayer_requests
       WHERE parish_id = @parishId AND (
         subject LIKE '%' + @searchTerm + '%' OR
         description LIKE '%' + @searchTerm + '%' OR
         requester_name LIKE '%' + @searchTerm + '%'
       )
       ORDER BY booking_date DESC, booking_time DESC`,
      { parishId, searchTerm }
    );

    return result.recordset;
  }

  /**
   * Get upcoming prayer requests
   */
  public static async getUpcoming(parishId: number, limit: number = 10): Promise<IPrayerRequest[]> {
    const result = await database.executeQuery<IPrayerRequest>(
      `SELECT TOP (@limit) * FROM prayer_requests
       WHERE parish_id = @parishId
         AND status IN ('pending', 'confirmed')
         AND CAST(booking_date AS DATETIME) + CAST(booking_time AS DATETIME) >= GETDATE()
       ORDER BY booking_date ASC, booking_time ASC`,
      { parishId, limit }
    );

    return result.recordset;
  }

  /**
   * Get prayer request statistics for a parish
   */
  public static async getStats(parishId: number): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  }> {
    const result = await database.executeQuery<{
      status: string;
      count: number;
    }>(
      `SELECT status, COUNT(*) as count
       FROM prayer_requests
       WHERE parish_id = @parishId
       GROUP BY status`,
      { parishId }
    );

    const stats = {
      total: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    result.recordset.forEach((row) => {
      stats.total += row.count;
      if (row.status === 'pending') stats.pending = row.count;
      if (row.status === 'confirmed') stats.confirmed = row.count;
      if (row.status === 'completed') stats.completed = row.count;
      if (row.status === 'cancelled') stats.cancelled = row.count;
    });

    return stats;
  }

  /**
   * Auto-archive old prayer requests
   * Automatically completes prayer requests older than specified days
   * that are still in 'pending' or 'confirmed' status
   *
   * @param daysOld - Number of days after which to auto-complete (default: 10)
   * @returns Number of requests auto-archived
   */
  public static async autoArchiveOldRequests(daysOld: number = 10): Promise<number> {
    const result = await database.executeQuery<{ affected_rows: number }>(
      `UPDATE prayer_requests
       SET status = 'completed',
           notes = CASE
             WHEN notes IS NULL OR notes = ''
             THEN 'Auto-archived after ${daysOld} days'
             ELSE notes + ' (Auto-archived after ${daysOld} days)'
           END,
           updated_at = GETDATE()
       WHERE status IN ('pending', 'confirmed')
         AND created_at <= DATEADD(day, -@daysOld, GETDATE())`,
      { daysOld }
    );

    return result.rowsAffected[0] || 0;
  }
}

export default PrayerRequestModel;
