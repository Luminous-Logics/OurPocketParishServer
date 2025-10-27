import database from '../config/database';
import { IDailyBibleReading, IBibleBookmark, IBibleReadingHistory } from '../types';

export class BibleModel {
  // =====================================================
  // DAILY BIBLE READINGS
  // =====================================================

  /**
   * Get today's reading for a parish
   */
  public static async getTodaysReading(parishId: number): Promise<IDailyBibleReading | null> {
    const result = await database.executeQuery<IDailyBibleReading>(
      `SELECT * FROM daily_bible_readings
       WHERE parish_id = @parishId
         AND reading_date = CAST(GETDATE() AS DATE)
         AND is_active = 1`,
      { parishId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Get daily reading by date
   */
  public static async getReadingByDate(parishId: number, date: Date): Promise<IDailyBibleReading | null> {
    const result = await database.executeQuery<IDailyBibleReading>(
      `SELECT * FROM daily_bible_readings
       WHERE parish_id = @parishId
         AND reading_date = @date
         AND is_active = 1`,
      { parishId, date }
    );

    return result.recordset[0] || null;
  }

  /**
   * Create a daily Bible reading
   */
  public static async createDailyReading(readingData: {
    parish_id: number;
    reading_date: Date;
    book_name: string;
    chapter: number;
    verse_start?: number;
    verse_end?: number;
    translation?: string;
    title?: string;
    content?: string;
    created_by?: number;
  }): Promise<IDailyBibleReading> {
    const result = await database.executeQuery<{ reading_id: number }>(
      `INSERT INTO daily_bible_readings
         (parish_id, reading_date, book_name, chapter, verse_start, verse_end, translation, title, content, created_by)
       OUTPUT INSERTED.reading_id
       VALUES (@parish_id, @reading_date, @book_name, @chapter, @verse_start, @verse_end, @translation, @title, @content, @created_by)`,
      readingData
    );

    const readingId = result.recordset[0].reading_id;
    const reading = await database.executeQuery<IDailyBibleReading>(
      `SELECT * FROM daily_bible_readings WHERE reading_id = @readingId`,
      { readingId }
    );

    return reading.recordset[0];
  }

  // =====================================================
  // BIBLE BOOKMARKS
  // =====================================================

  /**
   * Get all bookmarks for a user
   */
  public static async getUserBookmarks(userId: number): Promise<IBibleBookmark[]> {
    const result = await database.executeQuery<IBibleBookmark>(
      `SELECT * FROM bible_bookmarks
       WHERE user_id = @userId
       ORDER BY created_at DESC`,
      { userId }
    );

    return result.recordset;
  }

  /**
   * Create a bookmark
   */
  public static async createBookmark(bookmarkData: {
    user_id: number;
    book_name: string;
    chapter: number;
    verse_start?: number;
    verse_end?: number;
    translation?: string;
    note?: string;
    highlight_color?: string;
    is_favorite?: boolean;
  }): Promise<IBibleBookmark> {
    const result = await database.executeQuery<{ bookmark_id: number }>(
      `INSERT INTO bible_bookmarks
         (user_id, book_name, chapter, verse_start, verse_end, translation, note, highlight_color, is_favorite)
       OUTPUT INSERTED.bookmark_id
       VALUES (@user_id, @book_name, @chapter, @verse_start, @verse_end, @translation, @note, @highlight_color, @is_favorite)`,
      bookmarkData
    );

    const bookmarkId = result.recordset[0].bookmark_id;
    const bookmark = await database.executeQuery<IBibleBookmark>(
      `SELECT * FROM bible_bookmarks WHERE bookmark_id = @bookmarkId`,
      { bookmarkId }
    );

    return bookmark.recordset[0];
  }

  /**
   * Delete a bookmark
   */
  public static async deleteBookmark(bookmarkId: number, userId: number): Promise<void> {
    await database.executeQuery(
      `DELETE FROM bible_bookmarks WHERE bookmark_id = @bookmarkId AND user_id = @userId`,
      { bookmarkId, userId }
    );
  }

  // =====================================================
  // READING HISTORY
  // =====================================================

  /**
   * Record reading history
   */
  public static async recordReading(historyData: {
    user_id: number;
    book_name: string;
    chapter: number;
    verse_start?: number;
    verse_end?: number;
    translation?: string;
    reading_duration_seconds?: number;
    completed?: boolean;
  }): Promise<IBibleReadingHistory> {
    const result = await database.executeQuery<{ history_id: number }>(
      `INSERT INTO bible_reading_history
         (user_id, book_name, chapter, verse_start, verse_end, translation, reading_duration_seconds, completed)
       OUTPUT INSERTED.history_id
       VALUES (@user_id, @book_name, @chapter, @verse_start, @verse_end, @translation, @reading_duration_seconds, @completed)`,
      historyData
    );

    const historyId = result.recordset[0].history_id;
    const history = await database.executeQuery<IBibleReadingHistory>(
      `SELECT * FROM bible_reading_history WHERE history_id = @historyId`,
      { historyId }
    );

    return history.recordset[0];
  }

  /**
   * Get user reading history
   */
  public static async getUserHistory(userId: number, limit: number = 20): Promise<IBibleReadingHistory[]> {
    const result = await database.executeQuery<IBibleReadingHistory>(
      `SELECT TOP (@limit) * FROM bible_reading_history
       WHERE user_id = @userId
       ORDER BY created_at DESC`,
      { userId, limit }
    );

    return result.recordset;
  }
}

export default BibleModel;
