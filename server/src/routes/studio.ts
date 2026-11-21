import { and, asc, eq, inArray, max } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  lmsCourseSectionsTable,
  lmsLessonCompletionsTable,
  lmsLessonsTable,
  lmsQuizAttemptsTable,
  lmsQuizQuestionsTable,
  type LmsCourse,
  type LmsCourseSection,
  type LmsLesson,
  type LmsQuizQuestion,
} from "../db";
import { canManageCourse, findCourse, isEnrolled, loadCourseForWrite } from "../lib/access";
import type { AuthUser } from "../lib/auth";
import {
  assertSafeUrl,
  learnerCourseProgress,
  recordLessonCompletion,
  refreshCourseLessonCount,
  sanitizeLessonHtml,
} from "../lib/content";
import { badRequest, notFound, parseOr400, toIso } from "../lib/http";
import { currentUser, requireRole } from "../middlewares/auth";
import {
  CompleteLessonParams,
  CreateCourseLessonBody,
  CreateCourseLessonParams,
  CreateCourseSectionBody,
  CreateCourseSectionParams,
  DeleteCourseSectionParams,
  DeleteLessonParams,
  GetCourseOutlineParams,
  GetLessonParams,
  ReorderCourseOutlineBody,
  ReorderCourseOutlineParams,
  ReplaceQuizQuestionsBody,
  ReplaceQuizQuestionsParams,
  SubmitQuizAttemptBody,
  SubmitQuizAttemptParams,
  UpdateCourseSectionBody,
  UpdateCourseSectionParams,
  UpdateLessonBody,
  UpdateLessonParams,
} from "../schemas";

const router = Router();

// ---------------------------------------------------------------------------
// Quyền truy cập
//  - Sửa: giảng viên phụ trách hoặc admin (canManageCourse)
//  - Xem: admin/giảng viên; học viên khi khóa học đang mở hoặc đã ghi danh
//  - Bài chưa xuất bản chỉ người được sửa mới thấy
// ---------------------------------------------------------------------------
async function canViewCourse(user: AuthUser, course: LmsCourse) {
  if (user.role !== "student") return true;
  return course.status === "Đang hoạt động" || (await isEnrolled(user.id, course.id));
}

async function loadCourseForView(user: AuthUser, courseId: number) {
  const course = await findCourse(courseId);
  if (!(await canViewCourse(user, course))) throw notFound("Không tìm thấy khóa học.");
  return { course, canEdit: canManageCourse(user, course) };
}

async function findLesson(id: number): Promise<LmsLesson> {
  const [lesson] = await db.select().from(lmsLessonsTable).where(eq(lmsLessonsTable.id, id)).limit(1);
  if (!lesson) throw notFound("Không tìm thấy bài học.");
  return lesson;
}

async function findSection(id: number): Promise<LmsCourseSection> {
  const [section] = await db.select().from(lmsCourseSectionsTable).where(eq(lmsCourseSectionsTable.id, id)).limit(1);
  if (!section) throw notFound("Không tìm thấy chương.");
  return section;
}

/** Bài học mà người dùng được xem (ẩn bài chưa xuất bản với người không được sửa) */
async function loadLessonForView(user: AuthUser, lessonId: number) {
  const lesson = await findLesson(lessonId);
  const { course, canEdit } = await loadCourseForView(user, lesson.courseId);
  if (!lesson.isPublished && !canEdit) throw notFound("Không tìm thấy bài học.");
  return { lesson, course, canEdit };
}

async function loadLessonForWrite(user: AuthUser, lessonId: number) {
  const lesson = await findLesson(lessonId);
  const course = await loadCourseForWrite(user, lesson.courseId);
  return { lesson, course };
}

// ---------------------------------------------------------------------------
// Định dạng phản hồi
// ---------------------------------------------------------------------------
function formatQuestion(q: LmsQuizQuestion, canEdit: boolean) {
  return {
    id: q.id,
    prompt: q.prompt,
    options: q.options,
    // Đáp án & giải thích chỉ gửi cho người soạn bài
    correctIndex: canEdit ? q.correctIndex : null,
    explanation: canEdit ? (q.explanation ?? null) : null,
  };
}

async function loadQuestions(lessonId: number) {
  return db
    .select()
    .from(lmsQuizQuestionsTable)
    .where(eq(lmsQuizQuestionsTable.lessonId, lessonId))
    .orderBy(asc(lmsQuizQuestionsTable.position), asc(lmsQuizQuestionsTable.id));
}

async function buildLessonResponse(user: AuthUser, lesson: LmsLesson, canEdit: boolean) {
  const questions = lesson.type === "quiz" ? await loadQuestions(lesson.id) : [];
  const [completion] = await db
    .select({ id: lmsLessonCompletionsTable.id })
    .from(lmsLessonCompletionsTable)
    .where(and(eq(lmsLessonCompletionsTable.lessonId, lesson.id), eq(lmsLessonCompletionsTable.learnerId, user.id)))
    .limit(1);
  const [best] =
    lesson.type === "quiz"
      ? await db
          .select({ value: max(lmsQuizAttemptsTable.score) })
          .from(lmsQuizAttemptsTable)
          .where(and(eq(lmsQuizAttemptsTable.lessonId, lesson.id), eq(lmsQuizAttemptsTable.learnerId, user.id)))
      : [undefined];
  return {
    id: lesson.id,
    courseId: lesson.courseId,
    sectionId: lesson.sectionId,
    title: lesson.title,
    type: lesson.type as "video" | "text" | "document" | "quiz",
    position: lesson.position,
    contentHtml: lesson.contentHtml,
    mediaUrl: lesson.mediaUrl ?? null,
    durationMinutes: lesson.durationMinutes,
    isPublished: lesson.isPublished,
    passScore: lesson.passScore,
    questions: questions.map((q) => formatQuestion(q, canEdit)),
    completed: Boolean(completion),
    bestScore: best?.value ?? null,
    updatedAt: toIso(lesson.updatedAt) ?? new Date().toISOString(),
  };
}

async function buildOutline(user: AuthUser, course: LmsCourse, canEdit: boolean) {
  const sections = await db
    .select()
    .from(lmsCourseSectionsTable)
    .where(eq(lmsCourseSectionsTable.courseId, course.id))
    .orderBy(asc(lmsCourseSectionsTable.position), asc(lmsCourseSectionsTable.id));
  const lessons = await db
    .select()
    .from(lmsLessonsTable)
    .where(
      canEdit
        ? eq(lmsLessonsTable.courseId, course.id)
        : and(eq(lmsLessonsTable.courseId, course.id), eq(lmsLessonsTable.isPublished, true)),
    )
    .orderBy(asc(lmsLessonsTable.position), asc(lmsLessonsTable.id));
  const completed = lessons.length
    ? await db
        .select({ lessonId: lmsLessonCompletionsTable.lessonId })
        .from(lmsLessonCompletionsTable)
        .where(
          and(
            eq(lmsLessonCompletionsTable.learnerId, user.id),
            inArray(
              lmsLessonCompletionsTable.lessonId,
              lessons.map((l) => l.id),
            ),
          ),
        )
    : [];
  const completedIds = new Set(completed.map((c) => c.lessonId));

  return {
    courseId: course.id,
    canEdit,
    enrolled: user.role === "student" ? await isEnrolled(user.id, course.id) : false,
    sections: sections.map((section) => ({
      id: section.id,
      courseId: section.courseId,
      title: section.title,
      position: section.position,
      lessons: lessons
        .filter((l) => l.sectionId === section.id)
        .map((l) => ({
          id: l.id,
          sectionId: l.sectionId,
          title: l.title,
          type: l.type as "video" | "text" | "document" | "quiz",
          position: l.position,
          durationMinutes: l.durationMinutes,
          isPublished: l.isPublished,
          completed: completedIds.has(l.id),
        })),
    })),
    progress: await learnerCourseProgress(user.id, course.id),
  };
}

function formatSection(section: LmsCourseSection) {
  return { id: section.id, courseId: section.courseId, title: section.title, position: section.position, lessons: [] };
}

/** Bài học sẵn sàng xuất bản? Trả về lý do nếu chưa */
async function publishProblem(lesson: LmsLesson): Promise<string | null> {
  if ((lesson.type === "video" || lesson.type === "document") && !lesson.mediaUrl) {
    return lesson.type === "video" ? "Hãy thêm video trước khi xuất bản." : "Hãy tải tài liệu lên trước khi xuất bản.";
  }
  if (lesson.type === "quiz" && (await loadQuestions(lesson.id)).length === 0) {
    return "Bài kiểm tra cần ít nhất một câu hỏi trước khi xuất bản.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// ĐỀ CƯƠNG (OUTLINE)
// ---------------------------------------------------------------------------
router.get("/lms/courses/:id/outline", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(GetCourseOutlineParams, req.params);
  const { course, canEdit } = await loadCourseForView(user, id);
  res.json(await buildOutline(user, course, canEdit));
});

router.put("/lms/courses/:id/outline/order", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ReorderCourseOutlineParams, req.params);
  const { sections } = parseOr400(ReorderCourseOutlineBody, req.body);
  const course = await loadCourseForWrite(user, id);

  const existingSections = await db
    .select({ id: lmsCourseSectionsTable.id })
    .from(lmsCourseSectionsTable)
    .where(eq(lmsCourseSectionsTable.courseId, id));
  const existingLessons = await db
    .select({ id: lmsLessonsTable.id })
    .from(lmsLessonsTable)
    .where(eq(lmsLessonsTable.courseId, id));

  const sameSet = (a: number[], b: number[]) => a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));
  const sentSectionIds = sections.map((s) => s.id);
  const sentLessonIds = sections.flatMap((s) => s.lessonIds);
  if (!sameSet(sentSectionIds, existingSections.map((s) => s.id))) {
    throw badRequest("Danh sách chương không khớp với khóa học. Hãy tải lại trang và thử lại.");
  }
  if (!sameSet(sentLessonIds, existingLessons.map((l) => l.id))) {
    throw badRequest("Danh sách bài học không khớp với khóa học. Hãy tải lại trang và thử lại.");
  }

  db.transaction((tx) => {
    sections.forEach((section, sectionIndex) => {
      tx.update(lmsCourseSectionsTable)
        .set({ position: sectionIndex })
        .where(eq(lmsCourseSectionsTable.id, section.id))
        .run();
      section.lessonIds.forEach((lessonId, lessonIndex) => {
        tx.update(lmsLessonsTable)
          .set({ sectionId: section.id, position: lessonIndex })
          .where(eq(lmsLessonsTable.id, lessonId))
          .run();
      });
    });
  });

  res.json(await buildOutline(user, course, true));
});

// ---------------------------------------------------------------------------
// CHƯƠNG (SECTIONS)
// ---------------------------------------------------------------------------
router.post("/lms/courses/:id/sections", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CreateCourseSectionParams, req.params);
  const { title } = parseOr400(CreateCourseSectionBody, req.body);
  await loadCourseForWrite(user, id);
  const [last] = await db
    .select({ value: max(lmsCourseSectionsTable.position) })
    .from(lmsCourseSectionsTable)
    .where(eq(lmsCourseSectionsTable.courseId, id));
  const [section] = await db
    .insert(lmsCourseSectionsTable)
    .values({ courseId: id, title: title.trim(), position: (last?.value ?? -1) + 1 })
    .returning();
  res.status(201).json(formatSection(section!));
});

router.patch("/lms/sections/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(UpdateCourseSectionParams, req.params);
  const { title } = parseOr400(UpdateCourseSectionBody, req.body);
  const section = await findSection(id);
  await loadCourseForWrite(user, section.courseId);
  const [updated] = await db
    .update(lmsCourseSectionsTable)
    .set({ title: title.trim() })
    .where(eq(lmsCourseSectionsTable.id, id))
    .returning();
  res.json(formatSection(updated!));
});

router.delete("/lms/sections/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DeleteCourseSectionParams, req.params);
  const section = await findSection(id);
  await loadCourseForWrite(user, section.courseId);
  await db.delete(lmsCourseSectionsTable).where(eq(lmsCourseSectionsTable.id, id));
  await refreshCourseLessonCount(section.courseId);
  res.json({ message: "Đã xóa chương và các bài học trong chương." });
});

// ---------------------------------------------------------------------------
// BÀI HỌC (LESSONS)
// ---------------------------------------------------------------------------
router.post("/lms/courses/:id/lessons", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CreateCourseLessonParams, req.params);
  const body = parseOr400(CreateCourseLessonBody, req.body);
  await loadCourseForWrite(user, id);
  const section = await findSection(body.sectionId);
  if (section.courseId !== id) throw badRequest("Chương không thuộc khóa học này.");

  const [last] = await db
    .select({ value: max(lmsLessonsTable.position) })
    .from(lmsLessonsTable)
    .where(eq(lmsLessonsTable.sectionId, section.id));
  const now = new Date().toISOString();
  const [lesson] = await db
    .insert(lmsLessonsTable)
    .values({
      courseId: id,
      sectionId: section.id,
      title: body.title.trim(),
      type: body.type,
      position: (last?.value ?? -1) + 1,
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  res.status(201).json(await buildLessonResponse(user, lesson!, true));
});

router.get("/lms/lessons/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(GetLessonParams, req.params);
  const { lesson, canEdit } = await loadLessonForView(user, id);
  res.json(await buildLessonResponse(user, lesson, canEdit));
});

router.patch("/lms/lessons/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(UpdateLessonParams, req.params);
  const body = parseOr400(UpdateLessonBody, req.body);
  const { lesson } = await loadLessonForWrite(user, id);

  const changes: Partial<typeof lmsLessonsTable.$inferInsert> = {};
  if (body.title !== undefined) changes.title = body.title.trim();
  if (body.type !== undefined) changes.type = body.type;
  if (body.contentHtml !== undefined) changes.contentHtml = sanitizeLessonHtml(body.contentHtml);
  if (body.mediaUrl !== undefined) changes.mediaUrl = assertSafeUrl(body.mediaUrl, "Đường dẫn media");
  if (body.durationMinutes !== undefined) changes.durationMinutes = body.durationMinutes;
  if (body.passScore !== undefined) changes.passScore = body.passScore;
  if (body.isPublished !== undefined) changes.isPublished = body.isPublished;

  const next = { ...lesson, ...changes } as LmsLesson;
  if (next.isPublished) {
    const problem = await publishProblem(next);
    if (problem) throw badRequest(problem);
  }

  const [updated] = await db
    .update(lmsLessonsTable)
    .set({ ...changes, updatedAt: new Date().toISOString() })
    .where(eq(lmsLessonsTable.id, id))
    .returning();
  if (body.isPublished !== undefined && body.isPublished !== lesson.isPublished) {
    await refreshCourseLessonCount(lesson.courseId);
  }
  res.json(await buildLessonResponse(user, updated!, true));
});

router.delete("/lms/lessons/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DeleteLessonParams, req.params);
  const { lesson } = await loadLessonForWrite(user, id);
  await db.delete(lmsLessonsTable).where(eq(lmsLessonsTable.id, id));
  await refreshCourseLessonCount(lesson.courseId);
  res.json({ message: "Đã xóa bài học." });
});

router.put("/lms/lessons/:id/questions", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ReplaceQuizQuestionsParams, req.params);
  const { questions } = parseOr400(ReplaceQuizQuestionsBody, req.body);
  const { lesson } = await loadLessonForWrite(user, id);
  if (lesson.type !== "quiz") throw badRequest("Chỉ bài kiểm tra (quiz) mới có câu hỏi.");
  if (lesson.isPublished && questions.length === 0) {
    throw badRequest("Bài kiểm tra đã xuất bản cần ít nhất một câu hỏi. Hãy ẩn bài trước khi xóa hết câu hỏi.");
  }
  questions.forEach((q, index) => {
    if (q.correctIndex >= q.options.length) {
      throw badRequest(`Câu ${index + 1}: đáp án đúng không nằm trong các lựa chọn.`);
    }
  });

  db.transaction((tx) => {
    tx.delete(lmsQuizQuestionsTable).where(eq(lmsQuizQuestionsTable.lessonId, id)).run();
    if (questions.length) {
      tx.insert(lmsQuizQuestionsTable)
        .values(
          questions.map((q, index) => ({
            lessonId: id,
            position: index,
            prompt: q.prompt.trim(),
            options: q.options.map((o) => o.trim()),
            correctIndex: q.correctIndex,
            explanation: q.explanation?.trim() || null,
          })),
        )
        .run();
    }
    tx.update(lmsLessonsTable).set({ updatedAt: new Date().toISOString() }).where(eq(lmsLessonsTable.id, id)).run();
  });

  res.json(await buildLessonResponse(user, await findLesson(id), true));
});

// ---------------------------------------------------------------------------
// HỌC VIÊN: HOÀN THÀNH BÀI & LÀM QUIZ (chấm điểm trên máy chủ)
// ---------------------------------------------------------------------------
router.post("/lms/lessons/:id/complete", requireRole("student"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CompleteLessonParams, req.params);
  const { lesson, course } = await loadLessonForView(user, id);
  if (lesson.type === "quiz") throw badRequest("Hãy làm bài kiểm tra để hoàn thành bài này.");
  res.json(await recordLessonCompletion({ learnerId: user.id, lesson, course, pointsAwarded: 10 }));
});

router.post("/lms/lessons/:id/quiz-attempts", requireRole("student"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(SubmitQuizAttemptParams, req.params);
  const { answers } = parseOr400(SubmitQuizAttemptBody, req.body);
  const { lesson, course } = await loadLessonForView(user, id);
  if (lesson.type !== "quiz") throw badRequest("Bài học này không phải bài kiểm tra.");

  const questions = await loadQuestions(lesson.id);
  if (questions.length === 0) throw badRequest("Bài kiểm tra chưa có câu hỏi.");
  if (answers.length !== questions.length) {
    throw badRequest(`Cần trả lời đủ ${questions.length} câu hỏi.`);
  }
  answers.forEach((answer, index) => {
    if (answer >= questions[index]!.options.length) throw badRequest(`Câu ${index + 1}: lựa chọn không hợp lệ.`);
  });

  const results = questions.map((q, index) => ({
    questionId: q.id,
    chosenIndex: answers[index]!,
    correctIndex: q.correctIndex,
    correct: answers[index] === q.correctIndex,
    explanation: q.explanation ?? null,
  }));
  const correctCount = results.filter((r) => r.correct).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= lesson.passScore;

  await db.insert(lmsQuizAttemptsTable).values({ lessonId: lesson.id, learnerId: user.id, answers, score, passed });

  const completion = passed
    ? await recordLessonCompletion({
        learnerId: user.id,
        lesson,
        course,
        pointsAwarded: Math.max(10, Math.round(score * 1.5)),
        quizScore: score,
      })
    : null;

  res.status(201).json({
    score,
    passed,
    passScore: lesson.passScore,
    correctCount,
    total: questions.length,
    results,
    completion,
  });
});

/** Tài liệu gắn với bài học: bài học phải thuộc đúng khóa học */
export async function assertLessonInCourse(lessonId: number, courseId: number) {
  const lesson = await findLesson(lessonId);
  if (lesson.courseId !== courseId) throw badRequest("Bài học không thuộc khóa học này.");
  return lesson;
}

export default router;
