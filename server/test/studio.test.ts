import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db, lmsCoursesTable, lmsLearnersTable } from "../src/db";
import { hashPassword } from "../src/lib/auth";
import { ensureLmsSeeded } from "../src/lib/lms-seed";
import {
  CreateCourseLessonResponse,
  GetCourseOutlineResponse,
  GetLessonResponse,
  SubmitQuizAttemptResponse,
} from "../src/schemas";

const api = () => request(app);
const PASSWORD = "studio-pass-123";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type Actor = { id: number; token: string };
let owner: Actor;
let otherLecturer: Actor;
let student: Actor;
let courseId: number;
let sectionA: number;
let sectionB: number;
let textLessonId: number;
let videoLessonId: number;
let quizLessonId: number;

async function createAccount(email: string, role: "admin" | "lecturer" | "student"): Promise<Actor> {
  const [row] = await db
    .insert(lmsLearnersTable)
    .values({ name: email.split("@")[0]!, email, passwordHash: hashPassword(PASSWORD), role, team: "Test" })
    .returning();
  const res = await api().post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: row!.id, token: res.body.token };
}

beforeAll(async () => {
  await ensureLmsSeeded();
  owner = await createAccount("studio.owner@test.vn", "lecturer");
  otherLecturer = await createAccount("studio.other@test.vn", "lecturer");
  student = await createAccount("studio.student@test.vn", "student");

  const course = await api().post("/api/lms/courses").set(auth(owner.token)).send({
    title: "Khóa học studio",
    description: "Kiểm thử",
    category: "Test",
    level: "Cơ bản",
    duration: "1 giờ",
    format: "Native",
    lessons: 99,
  });
  expect(course.status, JSON.stringify(course.body)).toBe(201);
  courseId = course.body.id;
  expect(course.body.lessons).toBe(0); // số bài học không còn nhập tay

  const a = await api().post(`/api/lms/courses/${courseId}/sections`).set(auth(owner.token)).send({ title: "Chương A" });
  const b = await api().post(`/api/lms/courses/${courseId}/sections`).set(auth(owner.token)).send({ title: "Chương B" });
  expect(a.status).toBe(201);
  sectionA = a.body.id;
  sectionB = b.body.id;

  const make = async (title: string, type: string, sectionId: number) => {
    const res = await api().post(`/api/lms/courses/${courseId}/lessons`).set(auth(owner.token)).send({ sectionId, title, type });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return CreateCourseLessonResponse.parse(res.body).id;
  };
  textLessonId = await make("Bài đọc", "text", sectionA);
  videoLessonId = await make("Bài video", "video", sectionA);
  quizLessonId = await make("Bài kiểm tra", "quiz", sectionB);
});

describe("editing permissions", () => {
  it("only the instructor or an admin can change the outline", async () => {
    expect(
      (await api().post(`/api/lms/courses/${courseId}/sections`).set(auth(otherLecturer.token)).send({ title: "X" })).status,
    ).toBe(403);
    expect((await api().patch(`/api/lms/lessons/${textLessonId}`).set(auth(otherLecturer.token)).send({ title: "X" })).status).toBe(
      403,
    );
    expect((await api().delete(`/api/lms/lessons/${textLessonId}`).set(auth(student.token))).status).toBe(403);
    expect(
      (await api().put(`/api/lms/lessons/${quizLessonId}/questions`).set(auth(student.token)).send({ questions: [] })).status,
    ).toBe(403);
  });

  it("rejects a lesson in a section of another course", async () => {
    const other = await api().post("/api/lms/courses").set(auth(otherLecturer.token)).send({
      title: "Khóa khác",
      description: "",
      category: "",
      level: "Cơ bản",
      duration: "",
      format: "Native",
    });
    const otherSection = await api()
      .post(`/api/lms/courses/${other.body.id}/sections`)
      .set(auth(otherLecturer.token))
      .send({ title: "S" });
    const res = await api()
      .post(`/api/lms/courses/${courseId}/lessons`)
      .set(auth(owner.token))
      .send({ sectionId: otherSection.body.id, title: "Lạc chỗ", type: "text" });
    expect(res.status).toBe(400);
  });
});

describe("lesson content", () => {
  it("sanitizes HTML and rejects unsafe media URLs", async () => {
    const res = await api()
      .patch(`/api/lms/lessons/${textLessonId}`)
      .set(auth(owner.token))
      .send({
        contentHtml:
          '<h2>Tiêu đề</h2><p onclick="steal()">Xin chào<script>alert(1)</script></p>' +
          '<a href="javascript:alert(1)">bad</a><a href="https://example.com">ok</a><img src="x" onerror="alert(1)">',
        durationMinutes: 12,
      });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const html = GetLessonResponse.parse(res.body).contentHtml;
    expect(html).toContain("<h2>Tiêu đề</h2>");
    expect(html).not.toMatch(/script|onclick|onerror|javascript:/i);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');

    const badUrl = await api()
      .patch(`/api/lms/lessons/${videoLessonId}`)
      .set(auth(owner.token))
      .send({ mediaUrl: "javascript:alert(1)" });
    expect(badUrl.status).toBe(400);
  });

  it("refuses to publish incomplete lessons", async () => {
    expect(
      (await api().patch(`/api/lms/lessons/${videoLessonId}`).set(auth(owner.token)).send({ isPublished: true })).status,
    ).toBe(400);
    expect((await api().patch(`/api/lms/lessons/${quizLessonId}`).set(auth(owner.token)).send({ isPublished: true })).status).toBe(
      400,
    );
  });

  it("validates quiz questions and publishes lessons", async () => {
    const bad = await api()
      .put(`/api/lms/lessons/${quizLessonId}/questions`)
      .set(auth(owner.token))
      .send({ questions: [{ prompt: "?", options: ["a", "b"], correctIndex: 5 }] });
    expect(bad.status).toBe(400);

    const ok = await api()
      .put(`/api/lms/lessons/${quizLessonId}/questions`)
      .set(auth(owner.token))
      .send({
        questions: [
          { prompt: "1 + 1 = ?", options: ["1", "2", "3"], correctIndex: 1, explanation: "Hai" },
          { prompt: "Thủ đô Việt Nam?", options: ["Hà Nội", "Huế"], correctIndex: 0 },
        ],
      });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.questions[0].correctIndex).toBe(1);

    for (const [id, body] of [
      [textLessonId, { isPublished: true }],
      [videoLessonId, { mediaUrl: "/uploads/video.mp4", isPublished: true }],
      [quizLessonId, { isPublished: true, passScore: 100 }],
    ] as const) {
      const res = await api().patch(`/api/lms/lessons/${id}`).set(auth(owner.token)).send(body);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
    const course = await api().get(`/api/lms/courses/${courseId}`).set(auth(owner.token));
    expect(course.body.lessons).toBe(3);
  });

  it("never sends quiz answers to students", async () => {
    const res = await api().get(`/api/lms/lessons/${quizLessonId}`).set(auth(student.token));
    expect(res.status).toBe(200);
    const lesson = GetLessonResponse.parse(res.body);
    expect(lesson.questions).toHaveLength(2);
    expect(lesson.questions.every((q) => q.correctIndex === null && q.explanation === null)).toBe(true);
  });
});

describe("outline visibility and ordering", () => {
  it("hides unpublished lessons from everyone but the editors", async () => {
    const draft = await api()
      .post(`/api/lms/courses/${courseId}/lessons`)
      .set(auth(owner.token))
      .send({ sectionId: sectionB, title: "Bản nháp", type: "text" });

    const studentOutline = GetCourseOutlineResponse.parse(
      (await api().get(`/api/lms/courses/${courseId}/outline`).set(auth(student.token))).body,
    );
    const studentLessons = studentOutline.sections.flatMap((s) => s.lessons.map((l) => l.id));
    expect(studentLessons).not.toContain(draft.body.id);
    expect(studentOutline.canEdit).toBe(false);
    expect((await api().get(`/api/lms/lessons/${draft.body.id}`).set(auth(student.token))).status).toBe(404);

    const ownerOutline = (await api().get(`/api/lms/courses/${courseId}/outline`).set(auth(owner.token))).body;
    expect(ownerOutline.canEdit).toBe(true);
    expect(ownerOutline.sections.flatMap((s: { lessons: { id: number }[] }) => s.lessons.map((l) => l.id))).toContain(
      draft.body.id,
    );

    await api().delete(`/api/lms/lessons/${draft.body.id}`).set(auth(owner.token));
  });

  it("reorders sections and moves lessons between them", async () => {
    const incomplete = await api()
      .put(`/api/lms/courses/${courseId}/outline/order`)
      .set(auth(owner.token))
      .send({ sections: [{ id: sectionA, lessonIds: [textLessonId] }] });
    expect(incomplete.status).toBe(400);

    const res = await api()
      .put(`/api/lms/courses/${courseId}/outline/order`)
      .set(auth(owner.token))
      .send({
        sections: [
          { id: sectionB, lessonIds: [quizLessonId, videoLessonId] },
          { id: sectionA, lessonIds: [textLessonId] },
        ],
      });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const outline = GetCourseOutlineResponse.parse(res.body);
    expect(outline.sections.map((s) => s.id)).toEqual([sectionB, sectionA]);
    expect(outline.sections[0]!.lessons.map((l) => l.id)).toEqual([quizLessonId, videoLessonId]);
  });
});

describe("student progress", () => {
  it("only students complete lessons, and quizzes must be passed", async () => {
    expect((await api().post(`/api/lms/lessons/${textLessonId}/complete`).set(auth(owner.token))).status).toBe(403);
    expect((await api().post(`/api/lms/lessons/${quizLessonId}/complete`).set(auth(student.token))).status).toBe(400);
  });

  it("scores quizzes on the server", async () => {
    const wrongLength = await api()
      .post(`/api/lms/lessons/${quizLessonId}/quiz-attempts`)
      .set(auth(student.token))
      .send({ answers: [1] });
    expect(wrongLength.status).toBe(400);

    const failed = SubmitQuizAttemptResponse.parse(
      (await api().post(`/api/lms/lessons/${quizLessonId}/quiz-attempts`).set(auth(student.token)).send({ answers: [1, 1] }))
        .body,
    );
    expect(failed).toMatchObject({ score: 50, passed: false, correctCount: 1, total: 2, completion: null });
    expect(failed.results[1]).toMatchObject({ correct: false, correctIndex: 0 });

    const passed = SubmitQuizAttemptResponse.parse(
      (await api().post(`/api/lms/lessons/${quizLessonId}/quiz-attempts`).set(auth(student.token)).send({ answers: [1, 0] }))
        .body,
    );
    expect(passed.score).toBe(100);
    expect(passed.passed).toBe(true);
    expect(passed.completion?.pointsAwarded).toBe(150);
    expect(passed.completion?.progress).toBe(33);
  });

  it("completes the course, enrolls the student and issues a certificate", async () => {
    await api().post(`/api/lms/lessons/${textLessonId}/complete`).set(auth(student.token)).expect(200);
    const last = await api().post(`/api/lms/lessons/${videoLessonId}/complete`).set(auth(student.token));
    expect(last.body).toMatchObject({ progress: 100, certificateIssued: true, pointsAwarded: 10 });

    // Hoàn thành lại không cộng điểm lần nữa
    const again = await api().post(`/api/lms/lessons/${videoLessonId}/complete`).set(auth(student.token));
    expect(again.body.pointsAwarded).toBe(0);

    const outline = GetCourseOutlineResponse.parse(
      (await api().get(`/api/lms/courses/${courseId}/outline`).set(auth(student.token))).body,
    );
    expect(outline.enrolled).toBe(true);
    expect(outline.progress).toEqual({ completed: 3, total: 3, percent: 100 });
  });
});

describe("course cover and materials", () => {
  it("validates the cover image URL", async () => {
    const bad = await api().patch(`/api/lms/courses/${courseId}`).set(auth(owner.token)).send({ coverImageUrl: "javascript:x" });
    expect(bad.status).toBe(400);
    const ok = await api()
      .patch(`/api/lms/courses/${courseId}`)
      .set(auth(owner.token))
      .send({ coverImageUrl: "/uploads/cover.jpg" });
    expect(ok.body.coverImageUrl).toBe("/uploads/cover.jpg");
  });

  it("only attaches materials to lessons of the same course", async () => {
    const [otherCourse] = await db.select({ id: lmsCoursesTable.id }).from(lmsCoursesTable).limit(1);
    const otherLesson = await api().get(`/api/lms/courses/${otherCourse!.id}/outline`).set(auth(owner.token));
    const foreignLessonId = otherLesson.body.sections[0]?.lessons[0]?.id;
    expect(foreignLessonId, "demo outline should be seeded").toBeTypeOf("number");

    const bad = await api()
      .post(`/api/lms/courses/${courseId}/materials`)
      .set(auth(owner.token))
      .send({ title: "Slide", type: "pdf", fileUrl: "/uploads/a.pdf", lessonId: foreignLessonId });
    expect(bad.status).toBe(400);
    const ok = await api()
      .post(`/api/lms/courses/${courseId}/materials`)
      .set(auth(owner.token))
      .send({ title: "Slide", type: "pdf", fileUrl: "/uploads/a.pdf", lessonId: textLessonId });
    expect(ok.status).toBe(201);
    expect(ok.body.lessonId).toBe(textLessonId);
  });
});
