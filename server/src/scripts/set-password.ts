/**
 * Đặt lại mật khẩu cho một tài khoản và thu hồi mọi phiên đăng nhập của tài khoản đó.
 *
 *   pnpm --filter server set-password <email> <mật-khẩu-mới>
 *
 * Trên Render: mở tab "Shell" của web service và chạy lệnh trên
 * (biến DATABASE_PATH của service đã có sẵn trong Shell).
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, lmsLearnersTable } from "../db";
import { deleteUserSessions, hashPassword } from "../lib/auth";

async function main() {
  const [email, password] = process.argv.slice(2).filter((arg) => arg !== "--");
  if (!email || !password) {
    console.error("Cách dùng: pnpm --filter server set-password <email> <mật-khẩu-mới>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Mật khẩu cần tối thiểu 8 ký tự.");
    process.exit(1);
  }

  const [user] = await db
    .update(lmsLearnersTable)
    .set({ passwordHash: hashPassword(password) })
    .where(sql`lower(${lmsLearnersTable.email}) = ${email.trim().toLowerCase()}`)
    .returning({ id: lmsLearnersTable.id, name: lmsLearnersTable.name, role: lmsLearnersTable.role });

  if (!user) {
    console.error(`Không tìm thấy tài khoản ${email}.`);
    process.exit(1);
  }
  await deleteUserSessions(user.id);
  console.log(`Đã đổi mật khẩu cho ${user.name} (${user.role}) và đăng xuất mọi phiên cũ.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
