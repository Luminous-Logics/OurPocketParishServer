import database from '../config/database';
import sql from 'mssql';

export interface IEmailQueue {
  queue_id: number;
  template_code: string;
  recipient_email: string;
  recipient_name?: string;
  variables?: string; // JSON string
  priority: number;
  scheduled_at?: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  attempts: number;
  max_attempts: number;
  last_error?: string;
  created_at: Date;
  processed_at?: Date;
}

export interface ICreateEmailQueue {
  template_code: string;
  recipient_email: string;
  recipient_name?: string;
  variables?: Record<string, any>;
  priority?: number;
  scheduled_at?: Date;
  max_attempts?: number;
}

export class EmailQueueModel {
  /**
   * Add email to queue
   */
  public static async enqueue(emailQueue: ICreateEmailQueue): Promise<IEmailQueue> {
    const variablesJson = emailQueue.variables ? JSON.stringify(emailQueue.variables) : null;

    const result = await database.getPool().request()
      .input('templateCode', sql.VarChar(100), emailQueue.template_code)
      .input('recipientEmail', sql.VarChar(255), emailQueue.recipient_email)
      .input('recipientName', sql.VarChar(255), emailQueue.recipient_name || null)
      .input('variables', sql.Text, variablesJson)
      .input('priority', sql.Int, emailQueue.priority || 5)
      .input('scheduledAt', sql.DateTime2, emailQueue.scheduled_at || null)
      .input('maxAttempts', sql.Int, emailQueue.max_attempts || 3)
      .query(`
        INSERT INTO email_queue (
          template_code, recipient_email, recipient_name, variables,
          priority, scheduled_at, max_attempts
        )
        OUTPUT INSERTED.*
        VALUES (
          @templateCode, @recipientEmail, @recipientName, @variables,
          @priority, @scheduledAt, @maxAttempts
        )
      `);

    return result.recordset[0];
  }

  /**
   * Get pending emails ready to send
   */
  public static async getPending(limit: number = 100): Promise<IEmailQueue[]> {
    const result = await database.getPool().request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) * FROM email_queue
        WHERE status = 'pending'
          AND attempts < max_attempts
          AND (scheduled_at IS NULL OR scheduled_at <= GETDATE())
        ORDER BY priority ASC, created_at ASC
      `);

    return result.recordset;
  }

  /**
   * Mark email as processing
   */
  public static async markAsProcessing(queueId: number): Promise<void> {
    await database.getPool().request()
      .input('queueId', sql.BigInt, queueId)
      .query(`
        UPDATE email_queue
        SET status = 'processing'
        WHERE queue_id = @queueId
      `);
  }

  /**
   * Mark email as sent
   */
  public static async markAsSent(queueId: number): Promise<void> {
    await database.getPool().request()
      .input('queueId', sql.BigInt, queueId)
      .query(`
        UPDATE email_queue
        SET status = 'sent', processed_at = GETDATE()
        WHERE queue_id = @queueId
      `);
  }

  /**
   * Mark email as failed and increment attempts
   */
  public static async markAsFailed(queueId: number, errorMessage: string): Promise<void> {
    await database.getPool().request()
      .input('queueId', sql.BigInt, queueId)
      .input('errorMessage', sql.Text, errorMessage)
      .query(`
        UPDATE email_queue
        SET
          attempts = attempts + 1,
          last_error = @errorMessage,
          status = CASE
            WHEN attempts + 1 >= max_attempts THEN 'failed'
            ELSE 'pending'
          END
        WHERE queue_id = @queueId
      `);
  }

  /**
   * Get queue statistics
   */
  public static async getStats(): Promise<any> {
    const result = await database.getPool().request().query(`
      SELECT
        COUNT(*) as total_queued,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM email_queue
      WHERE created_at >= DATEADD(day, -7, GETDATE())
    `);

    return result.recordset[0];
  }

  /**
   * Clean up processed emails (older than X days)
   */
  public static async cleanupProcessed(daysToKeep: number = 30): Promise<number> {
    const result = await database.getPool().request()
      .input('daysToKeep', sql.Int, daysToKeep)
      .query(`
        DELETE FROM email_queue
        WHERE status IN ('sent', 'failed')
          AND processed_at < DATEADD(day, -@daysToKeep, GETDATE())
      `);

    return result.rowsAffected[0];
  }

  /**
   * Retry failed emails
   */
  public static async retryFailed(queueId: number): Promise<void> {
    await database.getPool().request()
      .input('queueId', sql.BigInt, queueId)
      .query(`
        UPDATE email_queue
        SET status = 'pending', attempts = 0, last_error = NULL
        WHERE queue_id = @queueId AND status = 'failed'
      `);
  }
}
