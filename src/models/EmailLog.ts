import database from '../config/database';
import sql from 'mssql';

export interface IEmailLog {
  log_id: number;
  template_id?: number;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body_html?: string;
  body_text?: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  provider?: string;
  provider_message_id?: string;
  error_message?: string;
  sent_at?: Date;
  delivered_at?: Date;
  opened_at?: Date;
  clicked_at?: Date;
  variables?: string; // JSON string
  retry_count: number;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface ICreateEmailLog {
  template_id?: number;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body_html?: string;
  body_text?: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  provider?: string;
  provider_message_id?: string;
  error_message?: string;
  variables?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export class EmailLogModel {
  /**
   * Create email log entry
   */
  public static async create(log: ICreateEmailLog): Promise<IEmailLog> {
    const variablesJson = log.variables ? JSON.stringify(log.variables) : null;

    const result = await database.getPool().request()
      .input('templateId', sql.BigInt, log.template_id || null)
      .input('recipientEmail', sql.VarChar(255), log.recipient_email)
      .input('recipientName', sql.VarChar(255), log.recipient_name || null)
      .input('subject', sql.VarChar(500), log.subject)
      .input('bodyHtml', sql.Text, log.body_html || null)
      .input('bodyText', sql.Text, log.body_text || null)
      .input('status', sql.VarChar(20), log.status)
      .input('provider', sql.VarChar(50), log.provider || null)
      .input('providerMessageId', sql.VarChar(255), log.provider_message_id || null)
      .input('errorMessage', sql.Text, log.error_message || null)
      .input('variables', sql.Text, variablesJson)
      .input('ipAddress', sql.VarChar(50), log.ip_address || null)
      .input('userAgent', sql.VarChar(500), log.user_agent || null)
      .query(`
        INSERT INTO email_logs (
          template_id, recipient_email, recipient_name, subject, body_html, body_text,
          status, provider, provider_message_id, error_message, variables, ip_address, user_agent
        )
        OUTPUT INSERTED.*
        VALUES (
          @templateId, @recipientEmail, @recipientName, @subject, @bodyHtml, @bodyText,
          @status, @provider, @providerMessageId, @errorMessage, @variables, @ipAddress, @userAgent
        )
      `);

    return result.recordset[0];
  }

  /**
   * Update email log status
   */
  public static async updateStatus(
    logId: number,
    status: 'sent' | 'failed' | 'bounced',
    errorMessage?: string,
    providerMessageId?: string
  ): Promise<void> {
    const request = database.getPool().request()
      .input('logId', sql.BigInt, logId)
      .input('status', sql.VarChar(20), status);

    const setClauses = ['status = @status'];

    if (status === 'sent') {
      setClauses.push('sent_at = GETDATE()');
    }

    if (errorMessage) {
      request.input('errorMessage', sql.Text, errorMessage);
      setClauses.push('error_message = @errorMessage');
    }

    if (providerMessageId) {
      request.input('providerMessageId', sql.VarChar(255), providerMessageId);
      setClauses.push('provider_message_id = @providerMessageId');
    }

    await request.query(`
      UPDATE email_logs
      SET ${setClauses.join(', ')}
      WHERE log_id = @logId
    `);
  }

  /**
   * Increment retry count
   */
  public static async incrementRetryCount(logId: number): Promise<void> {
    await database.getPool().request()
      .input('logId', sql.BigInt, logId)
      .query('UPDATE email_logs SET retry_count = retry_count + 1 WHERE log_id = @logId');
  }

  /**
   * Get email logs with pagination
   */
  public static async getAll(
    page: number = 1,
    limit: number = 50,
    status?: string
  ): Promise<{ logs: IEmailLog[]; total: number }> {
    const offset = (page - 1) * limit;

    const whereClause = status ? 'WHERE status = @status' : '';
    const request = database.getPool().request()
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset);

    if (status) {
      request.input('status', sql.VarChar(20), status);
    }

    const [logsResult, countResult] = await Promise.all([
      request.query(`
        SELECT * FROM email_logs
        ${whereClause}
        ORDER BY created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `),
      request.query(`SELECT COUNT(*) as total FROM email_logs ${whereClause}`)
    ]);

    return {
      logs: logsResult.recordset,
      total: countResult.recordset[0].total
    };
  }

  /**
   * Get logs by email address
   */
  public static async getByEmail(email: string, limit: number = 10): Promise<IEmailLog[]> {
    const result = await database.getPool().request()
      .input('email', sql.VarChar(255), email)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit) * FROM email_logs
        WHERE recipient_email = @email
        ORDER BY created_at DESC
      `);

    return result.recordset;
  }

  /**
   * Get email statistics
   */
  public static async getStats(days: number = 7): Promise<any> {
    const result = await database.getPool().request()
      .input('days', sql.Int, days)
      .query(`
        SELECT
          COUNT(*) as total_emails,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced_count,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
        FROM email_logs
        WHERE created_at >= DATEADD(day, -@days, GETDATE())
      `);

    return result.recordset[0];
  }

  /**
   * Clean up old logs (older than X days)
   */
  public static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const result = await database.getPool().request()
      .input('daysToKeep', sql.Int, daysToKeep)
      .query(`
        DELETE FROM email_logs
        WHERE created_at < DATEADD(day, -@daysToKeep, GETDATE())
      `);

    return result.rowsAffected[0];
  }
}
