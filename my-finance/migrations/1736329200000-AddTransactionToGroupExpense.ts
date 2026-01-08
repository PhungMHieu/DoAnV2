import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionToGroupExpense1736329200000
  implements MigrationInterface
{
  name = 'AddTransactionToGroupExpense1736329200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm cột groupExpenseId vào bảng transactions
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "groupExpenseId" uuid NULL
    `);

    // 2. Tạo index cho groupExpenseId
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_groupExpenseId"
      ON "transactions" ("groupExpenseId")
    `);

    // 3. Thêm foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_groupExpenseId"
      FOREIGN KEY ("groupExpenseId")
      REFERENCES "group_expenses"("id")
      ON DELETE SET NULL
    `);

    // 4. Xóa cột amount và category từ group_expenses
    // Lưu ý: Cần migrate dữ liệu cũ trước khi xóa
    // Tạo transactions từ dữ liệu cũ của group_expenses
    await queryRunner.query(`
      INSERT INTO "transactions" ("id", "amount", "category", "note", "user_id", "date_time", "groupExpenseId")
      SELECT
        gen_random_uuid(),
        ge.amount::decimal,
        COALESCE(ge.category, 'Group Expense'),
        ge.title,
        ge."createdByUserId",
        ge."createdAt",
        ge.id
      FROM "group_expenses" ge
      WHERE NOT EXISTS (
        SELECT 1 FROM "transactions" t WHERE t."groupExpenseId" = ge.id
      )
    `);

    // 5. Xóa cột amount từ group_expenses
    await queryRunner.query(`
      ALTER TABLE "group_expenses"
      DROP COLUMN IF EXISTS "amount"
    `);

    // 6. Xóa cột category từ group_expenses
    await queryRunner.query(`
      ALTER TABLE "group_expenses"
      DROP COLUMN IF EXISTS "category"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Thêm lại cột amount và category vào group_expenses
    await queryRunner.query(`
      ALTER TABLE "group_expenses"
      ADD COLUMN IF NOT EXISTS "amount" numeric(18,2)
    `);

    await queryRunner.query(`
      ALTER TABLE "group_expenses"
      ADD COLUMN IF NOT EXISTS "category" varchar
    `);

    // 2. Migrate dữ liệu từ transactions về group_expenses
    await queryRunner.query(`
      UPDATE "group_expenses" ge
      SET
        amount = (
          SELECT COALESCE(SUM(t.amount), 0)
          FROM "transactions" t
          WHERE t."groupExpenseId" = ge.id
        ),
        category = (
          SELECT t.category
          FROM "transactions" t
          WHERE t."groupExpenseId" = ge.id
          LIMIT 1
        )
    `);

    // 3. Xóa foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "transactions"
      DROP CONSTRAINT IF EXISTS "FK_transactions_groupExpenseId"
    `);

    // 4. Xóa index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_transactions_groupExpenseId"
    `);

    // 5. Xóa cột groupExpenseId từ transactions
    await queryRunner.query(`
      ALTER TABLE "transactions"
      DROP COLUMN IF EXISTS "groupExpenseId"
    `);
  }
}
