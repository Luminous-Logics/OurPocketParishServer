import database from '../config/database';
import sql from 'mssql';

export interface IEmailTemplate {
  template_id: number;
  template_code: string;
  template_name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  category?: string;
  variables?: string; // JSON string array
  description?: string;
  is_active: boolean;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface ICreateEmailTemplate {
  template_code: string;
  template_name: string;
  subject: string;
  body_html: string;
  body_text?: string;
  category?: string;
  variables?: string[];
  description?: string;
  created_by?: number;
}

export class EmailTemplateModel {
  /**
   * Get all email templates
   */
  public static async getAll(activeOnly: boolean = true): Promise<IEmailTemplate[]> {
    const query = activeOnly
      ? 'SELECT * FROM email_templates WHERE is_active = 1 ORDER BY category, template_name'
      : 'SELECT * FROM email_templates ORDER BY category, template_name';

    const result = await database.getPool().request().query(query);
    return result.recordset;
  }

  /**
   * Get template by code
   */
  public static async getByCode(templateCode: string): Promise<IEmailTemplate | null> {
    const result = await database.getPool().request()
      .input('templateCode', sql.VarChar(100), templateCode)
      .query(`
        SELECT * FROM email_templates
        WHERE template_code = @templateCode AND is_active = 1
      `);

    return result.recordset[0] || null;
  }

  /**
   * Get template by ID
   */
  public static async getById(templateId: number): Promise<IEmailTemplate | null> {
    const result = await database.getPool().request()
      .input('templateId', sql.BigInt, templateId)
      .query('SELECT * FROM email_templates WHERE template_id = @templateId');

    return result.recordset[0] || null;
  }

  /**
   * Get templates by category
   */
  public static async getByCategory(category: string): Promise<IEmailTemplate[]> {
    const result = await database.getPool().request()
      .input('category', sql.VarChar(50), category)
      .query(`
        SELECT * FROM email_templates
        WHERE category = @category AND is_active = 1
        ORDER BY template_name
      `);

    return result.recordset;
  }

  /**
   * Create new email template
   */
  public static async create(template: ICreateEmailTemplate): Promise<IEmailTemplate> {
    const variablesJson = template.variables ? JSON.stringify(template.variables) : null;

    const result = await database.getPool().request()
      .input('templateCode', sql.VarChar(100), template.template_code)
      .input('templateName', sql.VarChar(255), template.template_name)
      .input('subject', sql.VarChar(500), template.subject)
      .input('bodyHtml', sql.Text, template.body_html)
      .input('bodyText', sql.Text, template.body_text || null)
      .input('category', sql.VarChar(50), template.category || null)
      .input('variables', sql.Text, variablesJson)
      .input('description', sql.Text, template.description || null)
      .input('createdBy', sql.BigInt, template.created_by || null)
      .query(`
        INSERT INTO email_templates (
          template_code, template_name, subject, body_html, body_text,
          category, variables, description, created_by
        )
        OUTPUT INSERTED.*
        VALUES (
          @templateCode, @templateName, @subject, @bodyHtml, @bodyText,
          @category, @variables, @description, @createdBy
        )
      `);

    return result.recordset[0];
  }

  /**
   * Update email template
   */
  public static async update(
    templateCode: string,
    updates: Partial<ICreateEmailTemplate> & { is_active?: boolean }
  ): Promise<IEmailTemplate> {
    const variablesJson = updates.variables ? JSON.stringify(updates.variables) : undefined;

    const setClauses: string[] = [];
    const request = database.getPool().request().input('templateCode', sql.VarChar(100), templateCode);

    if (updates.template_name !== undefined) {
      setClauses.push('template_name = @templateName');
      request.input('templateName', sql.VarChar(255), updates.template_name);
    }
    if (updates.subject !== undefined) {
      setClauses.push('subject = @subject');
      request.input('subject', sql.VarChar(500), updates.subject);
    }
    if (updates.body_html !== undefined) {
      setClauses.push('body_html = @bodyHtml');
      request.input('bodyHtml', sql.Text, updates.body_html);
    }
    if (updates.body_text !== undefined) {
      setClauses.push('body_text = @bodyText');
      request.input('bodyText', sql.Text, updates.body_text);
    }
    if (updates.category !== undefined) {
      setClauses.push('category = @category');
      request.input('category', sql.VarChar(50), updates.category);
    }
    if (variablesJson !== undefined) {
      setClauses.push('variables = @variables');
      request.input('variables', sql.Text, variablesJson);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = @description');
      request.input('description', sql.Text, updates.description);
    }
    if (updates.is_active !== undefined) {
      setClauses.push('is_active = @isActive');
      request.input('isActive', sql.Bit, updates.is_active);
    }

    setClauses.push('updated_at = GETDATE()');

    const result = await request.query(`
      UPDATE email_templates
      SET ${setClauses.join(', ')}
      OUTPUT INSERTED.*
      WHERE template_code = @templateCode
    `);

    return result.recordset[0];
  }

  /**
   * Soft delete template
   */
  public static async delete(templateCode: string): Promise<void> {
    await database.getPool().request()
      .input('templateCode', sql.VarChar(100), templateCode)
      .query(`
        UPDATE email_templates
        SET is_active = 0, updated_at = GETDATE()
        WHERE template_code = @templateCode
      `);
  }

  /**
   * Hard delete template (use with caution)
   */
  public static async hardDelete(templateCode: string): Promise<void> {
    await database.getPool().request()
      .input('templateCode', sql.VarChar(100), templateCode)
      .query('DELETE FROM email_templates WHERE template_code = @templateCode');
  }
}
