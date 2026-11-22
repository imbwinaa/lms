import { count } from "drizzle-orm";
import {
  db,
  lmsCourseSectionsTable,
  lmsCoursesTable,
  lmsLessonsTable,
  lmsQuizQuestionsTable,
} from "../db";
import { refreshCourseLessonCount } from "./content";

/**
 * Nội dung mẫu cho chế độ dữ liệu demo (SEED_DEMO_DATA): mỗi khóa học mẫu có 2 chương,
 * gồm bài video, bài đọc, bài tài liệu và một bài kiểm tra. Chỉ chạy khi chưa có chương nào.
 */
type DemoLesson =
  | { type: "video"; title: string; minutes: number; mediaUrl: string; html?: string }
  | { type: "text"; title: string; minutes: number; html: string }
  | { type: "document"; title: string; minutes: number; mediaUrl: string; html?: string }
  | {
      type: "quiz";
      title: string;
      minutes: number;
      questions: { prompt: string; options: string[]; correctIndex: number; explanation: string }[];
    };

const VIDEO_A = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const VIDEO_B = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function outlineFor(courseTitle: string): { title: string; lessons: DemoLesson[] }[] {
  return [
    {
      title: "Chương 1: Làm quen",
      lessons: [
        {
          type: "video",
          title: `Giới thiệu khóa học ${courseTitle}`,
          minutes: 5,
          mediaUrl: VIDEO_A,
          html: "<p>Xem video để nắm mục tiêu và lộ trình của khóa học.</p>",
        },
        {
          type: "text",
          title: "Mục tiêu & cách học hiệu quả",
          minutes: 10,
          html:
            "<h2>Sau khóa học, bạn có thể</h2><ul><li>Nắm vững kiến thức nền tảng của chủ đề.</li>" +
            "<li>Áp dụng vào tình huống thực tế ở lớp học và nơi làm việc.</li>" +
            "<li>Tự đánh giá tiến bộ qua các bài kiểm tra ngắn.</li></ul>" +
            "<p><strong>Mẹo:</strong> học mỗi ngày 15 phút hiệu quả hơn học dồn một buổi.</p>",
        },
      ],
    },
    {
      title: "Chương 2: Thực hành & kiểm tra",
      lessons: [
        {
          type: "video",
          title: "Tình huống thực tế",
          minutes: 10,
          mediaUrl: VIDEO_B,
          html: "<p>Quan sát tình huống và ghi lại 3 điểm bạn rút ra.</p>",
        },
        {
          type: "document",
          title: "Tài liệu đọc thêm",
          minutes: 15,
          mediaUrl: "/uploads/khung-nang-luc-so-2026.pdf",
          html: "<p>Đọc trang 1–5 trước khi làm bài kiểm tra.</p>",
        },
        {
          type: "quiz",
          title: "Kiểm tra cuối chương",
          minutes: 5,
          questions: [
            {
              prompt: "Cách học nào được khuyến nghị trong khóa học?",
              options: ["Học dồn một buổi trước kỳ thi", "Học đều mỗi ngày một ít", "Chỉ xem video, không thực hành"],
              correctIndex: 1,
              explanation: "Học đều đặn giúp ghi nhớ lâu hơn học dồn.",
            },
            {
              prompt: "Sau khi xem tình huống thực tế, bạn nên làm gì?",
              options: ["Bỏ qua và học bài tiếp theo", "Ghi lại các điểm rút ra", "Xem lại 5 lần"],
              correctIndex: 1,
              explanation: "Ghi chú giúp bạn chủ động liên hệ với thực tế.",
            },
          ],
        },
      ],
    },
  ];
}

export async function seedDemoOutlines(): Promise<void> {
  const [existing] = await db.select({ value: count() }).from(lmsCourseSectionsTable);
  if (Number(existing?.value ?? 0) > 0) return;

  const courses = await db.select({ id: lmsCoursesTable.id, title: lmsCoursesTable.title }).from(lmsCoursesTable);
  const now = new Date().toISOString();
  for (const course of courses) {
    const sections = outlineFor(course.title);
    for (const [sectionIndex, section] of sections.entries()) {
      const [createdSection] = await db
        .insert(lmsCourseSectionsTable)
        .values({ courseId: course.id, title: section.title, position: sectionIndex })
        .returning();
      for (const [lessonIndex, lesson] of section.lessons.entries()) {
        const [createdLesson] = await db
          .insert(lmsLessonsTable)
          .values({
            courseId: course.id,
            sectionId: createdSection!.id,
            title: lesson.title,
            type: lesson.type,
            position: lessonIndex,
            contentHtml: lesson.type === "quiz" ? "" : (lesson.html ?? ""),
            mediaUrl: lesson.type === "video" || lesson.type === "document" ? lesson.mediaUrl : null,
            durationMinutes: lesson.minutes,
            isPublished: true,
            passScore: 70,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (lesson.type === "quiz") {
          await db.insert(lmsQuizQuestionsTable).values(
            lesson.questions.map((q, position) => ({ lessonId: createdLesson!.id, position, ...q })),
          );
        }
      }
    }
    await refreshCourseLessonCount(course.id);
  }
}

