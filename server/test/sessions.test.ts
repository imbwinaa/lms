import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db, lmsLearnersTable } from "../src/db";
import { hashPassword } from "../src/lib/auth";
import { ensureLmsSeeded } from "../src/lib/lms-seed";
import { meetingPlatform } from "../src/routes/sessions";
import { CreateCourseSessionsResponse, ListCourseSessionsResponse, ListUpcomingSessionsResponse } from "../src/schemas";

const api = () => request(app);
const PASSWORD = "sessions-pass-123";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Actor = { id: number; token: string };
let owner: Actor;
let otherLecturer: Actor;
let enrolled: Actor;
let outsider: Actor;
let courseId: number;
let otherCourseId: number;

async function createAccount(email: string, role: "lecturer" | "student"): Promise<Actor> {
  const [row] = await db
    .insert(lmsLearnersTable)
    .values({ name: email.split("@")[0]!, email, passwordHash: hashPassword(PASSWORD), role, team: "Test" })
    .returning();
  const res = await api().post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: row!.id, token: res.body.token };
}

const courseBody = (title: string) => ({
  title,
  description: "",
  category: "Ngoại ngữ",
  level: "Cơ bản",
  duration: "",
  format: "Native",
});

const sessionBody = (overrides: Record<string, unknown> = {}) => ({
  title: "Buổi 1: Thanh điệu",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  startsAt: new Date(Date.now() + 2 * DAY).toISOString(),
  durationMinutes: 90,
  ...overrides,
});

beforeAll(async () => {
  await ensureLmsSeeded();
  owner = await createAccount("sched.owner@test.vn", "lecturer");
  otherLecturer = await createAccount("sched.other@test.vn", "lecturer");
  enrolled = await createAccount("sched.enrolled@test.vn", "student");
  outsider = await createAccount("sched.outsider@test.vn", "student");

  courseId = (await api().post("/api/lms/courses").set(auth(owner.token)).send(courseBody("Tiếng Trung sơ cấp"))).body.id;
  otherCourseId = (await api().post("/api/lms/courses").set(auth(otherLecturer.token)).send(courseBody("Khóa khác"))).body.id;
  const enroll = await api()
    .post("/api/lms/enrollments/auto-enroll")
    .set(auth(owner.token))
    .send({ courseId, learnerIds: [enrolled.id] });
  expect(enroll.status).toBe(201);
});

describe("meeting platforms", () => {
  it("recognises Teams, Meet and Zoom links", () => {
    expect(meetingPlatform("https://teams.microsoft.com/l/meetup-join/abc")).toBe("teams");
    expect(meetingPlatform("https://meet.google.com/abc-defg-hij")).toBe("meet");
    expect(meetingPlatform("https://us02web.zoom.us/j/123456789")).toBe("zoom");
    expect(meetingPlatform("https://example.com/room")).toBe("other");
    expect(meetingPlatform("https://notzoom.us.evil.com/j/1")).toBe("other");
  });
});

describe("creating sessions", () => {
  it("only lets the instructor or an admin schedule sessions", async () => {
    for (const actor of [otherLecturer, enrolled]) {
      const res = await api().post(`/api/lms/courses/${courseId}/sessions`).set(auth(actor.token)).send(sessionBody());
      expect(res.status).toBe(403);
    }
  });

  it("validates the link and the duration", async () => {
    const http = await api()
      .post(`/api/lms/courses/${courseId}/sessions`)
      .set(auth(owner.token))
      .send(sessionBody({ meetingUrl: "http://meet.google.com/x" }));
    expect(http.status).toBe(400);
    const js = await api()
      .post(`/api/lms/courses/${courseId}/sessions`)
      .set(auth(owner.token))
      .send(sessionBody({ meetingUrl: "javascript:alert(1)" }));
    expect(js.status).toBe(400);
    const tooShort = await api()
      .post(`/api/lms/courses/${courseId}/sessions`)
      .set(auth(owner.token))
      .send(sessionBody({ durationMinutes: 5 }));
    expect(tooShort.status).toBe(400);
  });

  it("creates a single session", async () => {
    const res = await api().post(`/api/lms/courses/${courseId}/sessions`).set(auth(owner.token)).send(sessionBody());
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const [session] = CreateCourseSessionsResponse.parse(res.body);
    expect(session).toMatchObject({ platform: "meet", seriesId: null, durationMinutes: 90, canJoin: true });
    expect(new Date(session!.endsAt).getTime() - new Date(session!.startsAt).getTime()).toBe(90 * 60_000);
  });

  it("creates a weekly series one week apart", async () => {
    const start = new Date(Date.now() + 3 * DAY);
    const res = await api()
      .post(`/api/lms/courses/${courseId}/sessions`)
      .set(auth(owner.token))
      .send(sessionBody({ title: "", startsAt: start.toISOString(), repeatWeeks: 4, meetingUrl: "https://us02web.zoom.us/j/1" }));
    expect(res.status).toBe(201);
    const series = CreateCourseSessionsResponse.parse(res.body);
    expect(series).toHaveLength(4);
    expect(new Set(series.map((s) => s.seriesId)).size).toBe(1);
    expect(series[0]!.seriesId).not.toBeNull();
    expect(series[0]!.title).toBe("Tiếng Trung sơ cấp"); // trống -> tên khóa học
    for (let i = 1; i < series.length; i++) {
      expect(new Date(series[i]!.startsAt).getTime() - new Date(series[i - 1]!.startsAt).getTime()).toBe(7 * DAY);
    }
  });

  it("only links lessons of the same course", async () => {
    const section = await api().post(`/api/lms/courses/${otherCourseId}/sections`).set(auth(otherLecturer.token)).send({ title: "S" });
    const lesson = await api()
      .post(`/api/lms/courses/${otherCourseId}/lessons`)
      .set(auth(otherLecturer.token))
      .send({ sectionId: section.body.id, title: "Bài lạ", type: "text" });
    const res = await api()
      .post(`/api/lms/courses/${courseId}/sessions`)
      .set(auth(owner.token))
      .send(sessionBody({ lessonId: lesson.body.id }));
    expect(res.status).toBe(400);
  });
});

describe("who sees the meeting link", () => {
  it("shows it to enrolled students but not to other viewers", async () => {
    const mine = ListCourseSessionsResponse.parse(
      (await api().get(`/api/lms/courses/${courseId}/sessions`).set(auth(enrolled.token))).body,
    );
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((s) => s.meetingUrl !== null && s.canJoin)).toBe(true);

    const theirs = ListCourseSessionsResponse.parse(
      (await api().get(`/api/lms/courses/${courseId}/sessions`).set(auth(outsider.token))).body,
    );
    expect(theirs.length).toBe(mine.length);
    expect(theirs.every((s) => s.meetingUrl === null && !s.canJoin)).toBe(true);

    const lecturer = ListCourseSessionsResponse.parse(
      (await api().get(`/api/lms/courses/${courseId}/sessions`).set(auth(otherLecturer.token))).body,
    );
    expect(lecturer.every((s) => s.meetingUrl === null)).toBe(true);
  });

  it("filters by date range", async () => {
    const to = new Date(Date.now() + 2.5 * DAY).toISOString();
    const res = await api()
      .get(`/api/lms/courses/${courseId}/sessions`)
      .query({ from: new Date().toISOString(), to })
      .set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1); // chỉ buổi đơn lẻ (sau 2 ngày); chuỗi bắt đầu sau 3 ngày
  });
});

describe("upcoming sessions for dashboards", () => {
  it("returns only the user's own courses, soonest first", async () => {
    const student = ListUpcomingSessionsResponse.parse(
      (await api().get("/api/lms/sessions/upcoming").query({ limit: 3 }).set(auth(enrolled.token))).body,
    );
    expect(student).toHaveLength(3);
    expect(student.every((s) => s.courseId === courseId)).toBe(true);
    const times = student.map((s) => new Date(s.startsAt).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    expect((await api().get("/api/lms/sessions/upcoming").set(auth(outsider.token))).body).toEqual([]);
    expect((await api().get("/api/lms/sessions/upcoming").set(auth(otherLecturer.token))).body).toEqual([]);
  });

  it("includes a session that is in progress, but not finished ones", async () => {
    const live = await api()
      .post(`/api/lms/courses/${courseId}/sessions`)
      .set(auth(owner.token))
      .send(sessionBody({ title: "Đang học", startsAt: new Date(Date.now() - 30 * 60_000).toISOString(), durationMinutes: 60 }));
    const ended = await api()
      .post(`/api/lms/courses/${courseId}/sessions`)
      .set(auth(owner.token))
      .send(sessionBody({ title: "Đã xong", startsAt: new Date(Date.now() - 3 * HOUR).toISOString(), durationMinutes: 60 }));
    const upcoming = (await api().get("/api/lms/sessions/upcoming").set(auth(enrolled.token))).body as { id: number }[];
    expect(upcoming[0]!.id).toBe(live.body[0].id);
    expect(upcoming.map((s) => s.id)).not.toContain(ended.body[0].id);
  });
});

describe("editing and cancelling", () => {
  it("edits one session, only by the instructor", async () => {
    const [session] = (await api().get(`/api/lms/courses/${courseId}/sessions`).set(auth(owner.token))).body;
    expect(
      (await api().patch(`/api/lms/sessions/${session.id}`).set(auth(enrolled.token)).send({ title: "X" })).status,
    ).toBe(403);
    const res = await api()
      .patch(`/api/lms/sessions/${session.id}`)
      .set(auth(owner.token))
      .send({ title: "Buổi mở đầu", meetingUrl: "https://teams.microsoft.com/l/meetup-join/xyz", durationMinutes: 45 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ title: "Buổi mở đầu", platform: "teams", durationMinutes: 45 });
  });

  it("cancels this and later sessions of a series only", async () => {
    const all = (await api().get(`/api/lms/courses/${courseId}/sessions`).set(auth(owner.token))).body as {
      id: number;
      seriesId: string | null;
    }[];
    const series = all.filter((s) => s.seriesId);
    expect(series).toHaveLength(4);

    expect((await api().delete(`/api/lms/sessions/${series[2]!.id}`).query({ scope: "following" }).set(auth(enrolled.token))).status).toBe(403);
    const res = await api().delete(`/api/lms/sessions/${series[2]!.id}`).query({ scope: "following" }).set(auth(owner.token));
    expect(res.body.deleted).toBe(2);

    const after = (await api().get(`/api/lms/courses/${courseId}/sessions`).set(auth(owner.token))).body as { id: number }[];
    const remaining = after.map((s) => s.id);
    expect(remaining).toContain(series[0]!.id);
    expect(remaining).toContain(series[1]!.id);
    expect(remaining).not.toContain(series[3]!.id);

    const single = await api().delete(`/api/lms/sessions/${series[0]!.id}`).set(auth(owner.token));
    expect(single.body.deleted).toBe(1);
  });
});
