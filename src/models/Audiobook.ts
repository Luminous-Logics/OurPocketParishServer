import database from '../config/database';
import { IAudiobook } from '../types';
import { ApiError } from '../utils/apiError';

export class AudiobookModel {
  /**
   * Find audiobook by ID
   */
  public static async findById(audiobookId: number): Promise<IAudiobook | null> {
    const result = await database.executeQuery<IAudiobook>(
      `SELECT * FROM audiobooks WHERE audiobook_id = @audiobookId`,
      { audiobookId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Find all audiobooks by parish ID with pagination
   */
  public static async findByParishId(
    parishId: number,
    page: number = 1,
    limit: number = 20
  ): Promise<IAudiobook[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IAudiobook>(
      `SELECT * FROM audiobooks
       WHERE parish_id = @parishId AND is_active = 1
       ORDER BY created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishId, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Get all audiobooks for a parish (no pagination)
   */
  public static async getAllByParish(parishId: number): Promise<IAudiobook[]> {
    const result = await database.executeQuery<IAudiobook>(
      `SELECT * FROM audiobooks
       WHERE parish_id = @parishId AND is_active = 1
       ORDER BY title ASC`,
      { parishId }
    );

    return result.recordset;
  }

  /**
   * Count audiobooks by parish ID
   */
  public static async countByParishId(parishId: number): Promise<number> {
    const result = await database.executeQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM audiobooks
       WHERE parish_id = @parishId AND is_active = 1`,
      { parishId }
    );

    return result.recordset[0].count;
  }

  /**
   * Create a new audiobook
   */
  public static async create(audiobookData: {
    parish_id: number;
    title: string;
    author: string;
    narrator?: string;
    description?: string;
    thumbnail_url?: string;
    audio_file_url?: string;
    duration_minutes?: number;
    file_size_mb?: number;
    category?: string;
    language?: string;
    publication_year?: number;
    created_by?: number;
  }): Promise<IAudiobook> {
    // Build dynamic INSERT query
    const fields: string[] = ['parish_id', 'title', 'author'];
    const params: Record<string, any> = {
      parish_id: audiobookData.parish_id,
      title: audiobookData.title,
      author: audiobookData.author,
    };

    // Add optional fields
    if (audiobookData.narrator !== undefined) {
      fields.push('narrator');
      params.narrator = audiobookData.narrator;
    }
    if (audiobookData.description !== undefined) {
      fields.push('description');
      params.description = audiobookData.description;
    }
    if (audiobookData.thumbnail_url !== undefined) {
      fields.push('thumbnail_url');
      params.thumbnail_url = audiobookData.thumbnail_url;
    }
    if (audiobookData.audio_file_url !== undefined) {
      fields.push('audio_file_url');
      params.audio_file_url = audiobookData.audio_file_url;
    }
    if (audiobookData.duration_minutes !== undefined) {
      fields.push('duration_minutes');
      params.duration_minutes = audiobookData.duration_minutes;
    }
    if (audiobookData.file_size_mb !== undefined) {
      fields.push('file_size_mb');
      params.file_size_mb = audiobookData.file_size_mb;
    }
    if (audiobookData.category !== undefined) {
      fields.push('category');
      params.category = audiobookData.category;
    }
    if (audiobookData.language !== undefined) {
      fields.push('language');
      params.language = audiobookData.language;
    }
    if (audiobookData.publication_year !== undefined) {
      fields.push('publication_year');
      params.publication_year = audiobookData.publication_year;
    }
    if (audiobookData.created_by !== undefined) {
      fields.push('created_by');
      params.created_by = audiobookData.created_by;
    }

    const fieldNames = fields.join(', ');
    const fieldParams = fields.map((f) => `@${f}`).join(', ');

    const result = await database.executeQuery<{ audiobook_id: number }>(
      `INSERT INTO audiobooks (${fieldNames})
       OUTPUT INSERTED.audiobook_id
       VALUES (${fieldParams})`,
      params
    );

    const audiobookId = result.recordset[0].audiobook_id;
    const audiobook = await this.findById(audiobookId);

    if (!audiobook) {
      throw ApiError.internal('Failed to create audiobook');
    }

    return audiobook;
  }

  /**
   * Update audiobook
   */
  public static async update(
    audiobookId: number,
    updates: Partial<Omit<IAudiobook, 'audiobook_id' | 'parish_id' | 'created_at' | 'updated_at' | 'created_by'>>
  ): Promise<IAudiobook> {
    const existingAudiobook = await this.findById(audiobookId);
    if (!existingAudiobook) {
      throw ApiError.notFound('Audiobook not found');
    }

    const updateFields: string[] = [];
    const params: Record<string, any> = { audiobookId };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return existingAudiobook;
    }

    await database.executeQuery(
      `UPDATE audiobooks SET ${updateFields.join(', ')}, updated_at = GETDATE()
       WHERE audiobook_id = @audiobookId`,
      params
    );

    const updatedAudiobook = await this.findById(audiobookId);
    if (!updatedAudiobook) {
      throw ApiError.internal('Failed to update audiobook');
    }

    return updatedAudiobook;
  }

  /**
   * Delete audiobook (soft delete)
   */
  public static async delete(audiobookId: number): Promise<void> {
    const audiobook = await this.findById(audiobookId);
    if (!audiobook) {
      throw ApiError.notFound('Audiobook not found');
    }

    await database.executeQuery(
      `UPDATE audiobooks SET is_active = 0, updated_at = GETDATE()
       WHERE audiobook_id = @audiobookId`,
      { audiobookId }
    );
  }

  /**
   * Search audiobooks by title, author, or narrator within a parish
   */
  public static async search(parishId: number, searchTerm: string): Promise<IAudiobook[]> {
    const result = await database.executeQuery<IAudiobook>(
      `SELECT * FROM audiobooks
       WHERE parish_id = @parishId AND is_active = 1 AND (
         title LIKE '%' + @searchTerm + '%' OR
         author LIKE '%' + @searchTerm + '%' OR
         narrator LIKE '%' + @searchTerm + '%'
       )
       ORDER BY title ASC`,
      { parishId, searchTerm }
    );

    return result.recordset;
  }

  /**
   * Find audiobooks by category
   */
  public static async findByCategory(
    parishId: number,
    category: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IAudiobook[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IAudiobook>(
      `SELECT * FROM audiobooks
       WHERE parish_id = @parishId AND category = @category AND is_active = 1
       ORDER BY title ASC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishId, category, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Find audiobooks by author
   */
  public static async findByAuthor(
    parishId: number,
    author: string,
    page: number = 1,
    limit: number = 20
  ): Promise<IAudiobook[]> {
    const offset = (page - 1) * limit;

    const result = await database.executeQuery<IAudiobook>(
      `SELECT * FROM audiobooks
       WHERE parish_id = @parishId AND author LIKE '%' + @author + '%' AND is_active = 1
       ORDER BY title ASC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { parishId, author, offset, limit }
    );

    return result.recordset;
  }

  /**
   * Get all unique categories for a parish
   */
  public static async getCategories(parishId: number): Promise<string[]> {
    const result = await database.executeQuery<{ category: string }>(
      `SELECT DISTINCT category FROM audiobooks
       WHERE parish_id = @parishId AND is_active = 1 AND category IS NOT NULL
       ORDER BY category ASC`,
      { parishId }
    );

    return result.recordset.map((row) => row.category);
  }
}

export default AudiobookModel;
