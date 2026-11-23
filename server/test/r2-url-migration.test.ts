import fs from "fs";
import path from "path";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, lmsCoursesTable, lmsLessonsTable } from "../src/db";
import { ensureLmsSeeded } from "../src/lib/lms-seed";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const SIGNED = "X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=604800&X-Amz-Signature=abc123";
const virtualHosted = (key: string) => `https://lms-media.${ACCOUNT}.r2.cloudflarestorage.com/${key}?${SIGNED}`;
const pathStyle = (key: string) => `https://${ACCOUNT}.r2.cloudflarestorage.com/lms-media/${key}?${SIGNED}`;

async function runMigrationAgain() {
  const file = path.join(__dirname, "..", "drizzle", "0003_r2_permanent_urls.sql");
  const statements = fs.readFileSync(file, "utf8").split("--> statement-breakpoint");
  for (const statement of statements) await db.execute(sql.raw(statement));
}

let courseId: number;
let lessonId: number;

beforeAll(async () => {
  await ensureLmsSeeded();
  const [course] = await db.select().from(lmsCoursesTable).limit(1);
  const [lesson] = await db.select().from(lmsLessonsTable).limit(1);
  courseId = course!.id;
  lessonId = lesson!.id;
});

describe("0003_r2_permanent_urls", () => {
  it("rewrites expiring presigned R2 links to the permanent proxy URL", async () => {
    await db
      .update(lmsCoursesTable)
      .set({ coverImageUrl: virtualHosted("1795000000000-cover.png"), mediaUrl: pathStyle("1795000000001-intro.mp4") })
      .where(eq(lmsCoursesTable.id, courseId));
    // Trong HTML, "&" được mã hóa thành "&amp;"
    const html =
      `<p>Hình:</p><img src="${virtualHosted("1795000000002-a.png").replaceAll("&", "&amp;")}">` +
      `<p><a href="${pathStyle("1795000000003-b.pdf")}">Tải</a> và <a href="https://example.com/x?y=1">link khác</a></p>`;
    await db.update(lmsLessonsTable).set({ contentHtml: html }).where(eq(lmsLessonsTable.id, lessonId));

    await runMigrationAgain();

    const [course] = await db.select().from(lmsCoursesTable).where(eq(lmsCoursesTable.id, courseId));
    expect(course!.coverImageUrl).toBe("/api/upload/r2/1795000000000-cover.png");
    expect(course!.mediaUrl).toBe("/api/upload/r2/1795000000001-intro.mp4");

    const [lesson] = await db.select().from(lmsLessonsTable).where(eq(lmsLessonsTable.id, lessonId));
    expect(lesson!.contentHtml).toBe(
      `<p>Hình:</p><img src="/api/upload/r2/1795000000002-a.png">` +
        `<p><a href="/api/upload/r2/1795000000003-b.pdf">Tải</a> và <a href="https://example.com/x?y=1">link khác</a></p>`,
    );

    // Chạy lại không thay đổi gì
    await runMigrationAgain();
    const [again] = await db.select().from(lmsCoursesTable).where(eq(lmsCoursesTable.id, courseId));
    expect(again!.coverImageUrl).toBe("/api/upload/r2/1795000000000-cover.png");
  });
});
