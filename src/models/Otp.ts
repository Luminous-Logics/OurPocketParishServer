import database from '../config/database';
import sql from 'mssql';

export interface IOtp {
  otp_id: number;
  user_id: number;
  otp_code: string;
  otp_type: 'login' | 'password_reset' | 'verification';
  delivery_method: 'sms' | 'email';
  phone?: string;
  email?: string;
  is_verified: boolean;
  expires_at: Date;
  created_at: Date;
  verified_at?: Date;
  ip_address?: string;
  attempts: number;
}

export interface ICreateOtp {
  user_id: number;
  otp_code: string;
  otp_type: 'login' | 'password_reset' | 'verification';
  delivery_method: 'sms' | 'email';
  phone?: string;
  email?: string;
  expires_at: Date;
  expires_in_minutes?: number; // Optional: minutes until expiry (alternative to expires_at)
  ip_address?: string;
}

export class OtpModel {
  /**
   * Create new OTP
   */
  public static async create(otp: ICreateOtp): Promise<IOtp> {
    // Use SQL Server's DATEADD to avoid timezone issues
    // Calculate minutes from now by comparing expires_at with current time
    const now = new Date();
    const minutesUntilExpiry = Math.round((otp.expires_at.getTime() - now.getTime()) / 60000);

    const result = await database.getPool().request()
      .input('userId', sql.BigInt, otp.user_id)
      .input('otpCode', sql.VarChar(6), otp.otp_code)
      .input('otpType', sql.VarChar(20), otp.otp_type)
      .input('deliveryMethod', sql.VarChar(10), otp.delivery_method)
      .input('phone', sql.VarChar(20), otp.phone || null)
      .input('email', sql.VarChar(255), otp.email || null)
      .input('expiryMinutes', sql.Int, minutesUntilExpiry)
      .input('ipAddress', sql.VarChar(50), otp.ip_address || null)
      .query(`
        INSERT INTO otp_codes (
          user_id, otp_code, otp_type, delivery_method, phone, email, expires_at, ip_address
        )
        OUTPUT INSERTED.*
        VALUES (
          @userId, @otpCode, @otpType, @deliveryMethod, @phone, @email,
          DATEADD(MINUTE, @expiryMinutes, GETDATE()), @ipAddress
        )
      `);

    return result.recordset[0];
  }

  /**
   * Get latest OTP for user
   */
  public static async getLatestByUser(
    userId: number,
    otpType: string = 'login'
  ): Promise<IOtp | null> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('otpType', sql.VarChar(20), otpType)
      .query(`
        SELECT TOP 1 * FROM otp_codes
        WHERE user_id = @userId AND otp_type = @otpType
        ORDER BY created_at DESC
      `);

    return result.recordset[0] || null;
  }

  /**
   * Verify OTP code
   */
  public static async verify(userId: number, otpCode: string, otpType: string = 'login'): Promise<IOtp | null> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('otpCode', sql.VarChar(6), otpCode)
      .input('otpType', sql.VarChar(20), otpType)
      .query(`
        SELECT TOP 1 * FROM otp_codes
        WHERE user_id = @userId
          AND otp_code = @otpCode
          AND otp_type = @otpType
          AND is_verified = 0
          AND expires_at > GETDATE()
          AND attempts < 3
        ORDER BY created_at DESC
      `);

    return result.recordset[0] || null;
  }

  /**
   * Mark OTP as verified
   */
  public static async markAsVerified(otpId: number): Promise<void> {
    await database.getPool().request()
      .input('otpId', sql.BigInt, otpId)
      .query(`
        UPDATE otp_codes
        SET is_verified = 1, verified_at = GETDATE()
        WHERE otp_id = @otpId
      `);
  }

  /**
   * Increment attempts
   */
  public static async incrementAttempts(otpId: number): Promise<void> {
    await database.getPool().request()
      .input('otpId', sql.BigInt, otpId)
      .query('UPDATE otp_codes SET attempts = attempts + 1 WHERE otp_id = @otpId');
  }

  /**
   * Invalidate all OTPs for user
   */
  public static async invalidateUserOtps(userId: number, otpType: string = 'login'): Promise<void> {
    await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('otpType', sql.VarChar(20), otpType)
      .query(`
        UPDATE otp_codes
        SET is_verified = 1
        WHERE user_id = @userId AND otp_type = @otpType AND is_verified = 0
      `);
  }

  /**
   * Clean up expired OTPs
   */
  public static async cleanupExpired(): Promise<number> {
    const result = await database.getPool().request().query(`
      DELETE FROM otp_codes
      WHERE expires_at < DATEADD(hour, -24, GETDATE())
    `);

    return result.rowsAffected[0];
  }

  /**
   * Check rate limiting (max OTPs per user per time period)
   */
  public static async checkRateLimit(
    userId: number,
    minutes: number = 60,
    maxAttempts: number = 3
  ): Promise<boolean> {
    const result = await database.getPool().request()
      .input('userId', sql.BigInt, userId)
      .input('minutes', sql.Int, minutes)
      .query(`
        SELECT COUNT(*) as count FROM otp_codes
        WHERE user_id = @userId
          AND created_at > DATEADD(minute, -@minutes, GETDATE())
      `);

    const count = result.recordset[0].count;
    return count < maxAttempts;
  }
}
