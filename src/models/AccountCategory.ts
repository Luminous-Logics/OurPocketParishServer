import database from '../config/database';
import { IAccountCategory } from '../types';
import { ApiError } from '../utils/apiError';

export class AccountCategoryModel {
  /**
   * Find category by ID
   */
  public static async findById(categoryId: number): Promise<IAccountCategory | null> {
    const result = await database.executeQuery<IAccountCategory>(
      `SELECT * FROM account_categories WHERE category_id = @categoryId`,
      { categoryId }
    );

    return result.recordset[0] || null;
  }

  /**
   * Find all active categories (GLOBAL - shared by all parishes)
   */
  public static async findAll(): Promise<IAccountCategory[]> {
    const result = await database.executeQuery<IAccountCategory>(
      `SELECT * FROM account_categories
       WHERE is_active = 1
       ORDER BY category_type, category_name ASC`
    );

    return result.recordset;
  }

  /**
   * Find categories by type (income or expense) - GLOBAL
   */
  public static async findByType(type: 'income' | 'expense'): Promise<IAccountCategory[]> {
    const result = await database.executeQuery<IAccountCategory>(
      `SELECT * FROM account_categories
       WHERE category_type = @type AND is_active = 1
       ORDER BY category_name ASC`,
      { type }
    );

    return result.recordset;
  }

  /**
   * Create a new account category (custom categories)
   */
  public static async create(categoryData: {
    category_name: string;
    category_type: 'income' | 'expense';
    description?: string;
  }): Promise<IAccountCategory> {
    const fields: string[] = ['category_name', 'category_type'];
    const params: Record<string, any> = {
      category_name: categoryData.category_name,
      category_type: categoryData.category_type,
    };

    // Custom categories are not system categories
    fields.push('is_system');
    params.is_system = 0;

    if (categoryData.description !== undefined) {
      fields.push('description');
      params.description = categoryData.description;
    }

    const fieldNames = fields.join(', ');
    const fieldParams = fields.map((f) => `@${f}`).join(', ');

    const result = await database.executeQuery<{ category_id: number }>(
      `INSERT INTO account_categories (${fieldNames})
       OUTPUT INSERTED.category_id
       VALUES (${fieldParams})`,
      params
    );

    const categoryId = result.recordset[0].category_id;
    const category = await this.findById(categoryId);

    if (!category) {
      throw ApiError.internal('Failed to create account category');
    }

    return category;
  }

  /**
   * Update account category (only non-system categories can be updated)
   */
  public static async update(
    categoryId: number,
    updates: Partial<Omit<IAccountCategory, 'category_id' | 'created_at' | 'updated_at' | 'is_system'>>
  ): Promise<IAccountCategory> {
    const existingCategory = await this.findById(categoryId);
    if (!existingCategory) {
      throw ApiError.notFound('Account category not found');
    }

    // Prevent updating system categories
    if (existingCategory.is_system) {
      throw ApiError.forbidden('Cannot update system categories');
    }

    const updateFields: string[] = [];
    const params: Record<string, any> = { categoryId };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = @${key}`);
        params[key] = value;
      }
    });

    if (updateFields.length === 0) {
      return existingCategory;
    }

    await database.executeQuery(
      `UPDATE account_categories SET ${updateFields.join(', ')}, updated_at = GETDATE()
       WHERE category_id = @categoryId`,
      params
    );

    const updatedCategory = await this.findById(categoryId);
    if (!updatedCategory) {
      throw ApiError.internal('Failed to update account category');
    }

    return updatedCategory;
  }

  /**
   * Delete account category (soft delete - only non-system categories)
   */
  public static async delete(categoryId: number): Promise<void> {
    const category = await this.findById(categoryId);
    if (!category) {
      throw ApiError.notFound('Account category not found');
    }

    // Prevent deleting system categories
    if (category.is_system) {
      throw ApiError.forbidden('Cannot delete system categories');
    }

    await database.executeQuery(
      `UPDATE account_categories SET is_active = 0, updated_at = GETDATE()
       WHERE category_id = @categoryId`,
      { categoryId }
    );
  }

  // Legacy methods for backward compatibility (now just call the global methods)
  public static async findByParishId(_parishId: number): Promise<IAccountCategory[]> {
    return this.findAll();
  }
}

export default AccountCategoryModel;
