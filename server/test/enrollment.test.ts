import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import app from "../src/app";
import { db, lmsLearnersTable } from "../src/db";
import { hashPassword } from "../src/lib/auth";
import { ensureLmsSeeded } from "../src/lib/lms-seed";
import { GetLmsCourseResponse as GetCourseResponse, ListLmsCoursesResponse as ListCoursesResponse } from "../src/schemas";

const api = () => request(app);
const PASSWORD = "enroll-pass-123";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type Actor = { id: number; token: string };
let owner: Actor;
let otherLecturer: Actor;
let alice: Actor;
let bob: Actor;
let carol: Actor;

async function createAccount(email: string, role: "lecturer" | "student"): Promise<Actor> {
  const [row] = await db
    .insert(lmsLearnersTable)
    .values({ name: email.split("@")[0]!, email, passwordHash: hashPassword(PASSWORD), role, team: "Test" })
    .returning();
  const res = await api().post("/api/auth/login").send({ email, password: PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { id: row!.id, token: res.body.token };
}

async function createCourse(title: string, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/lms/courses")
    .set(auth(owner.token))
    .send({ title, description: "", category: "Test", level: "Cơ bản", duration: "", format: "Native", ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as number;
}

const listIds = async (actor: Actor) =>
  ListCoursesResponse.parse((await api().get("/api/lms/courses").set(auth(actor.token))).body).map((c) => c.id);

beforeAll(async () => {
  await ensureLmsSeeded();
  owner = await createAccount("enr.owner@test.vn", "lecturer");
  otherLecturer = await createAccount("enr.other@test.vn", "lecturer");
  alice = await createAccount("enr.alice@test.vn", "student");
  bob = await createAccount("enr.bob@test.vn", "student");
  carol = await createAccount("enr.carol@test.vn", "student");
});

describe("course settings", () => {
  it("defaults to public + open and validates the values", async () => {
    const id = await createCourse("Mặc định");
    const course = GetCourseResponse.parse((await api().get(`/api/lms/courses/${id}`).set(auth(owner.token))).body);
    expect(course).toMatchObject({ visibility: "public", enrollmentMethod: "open", myEnrollment: "none" });
    expect((await api().patch(`/api/lms/courses/${id}`).set(auth(owner.token)).send({ visibility: "secret" })).status).toBe(400);
    const ok = await api().patch(`/api/lms/courses/${id}`).set(auth(owner.token)).send({ enrollmentMethod: "approval" });
    expect(ok.body.enrollmentMethod).toBe("approval");
  });
});

describe("open public course", () => {
  it("lets a student join immediately", async () => {
    const id = await createCourse("Khóa mở");
    expect(await listIds(alice)).toContain(id);
    const res = await api().post(`/api/lms/courses/${id}/join`).set(auth(alice.token)).send({});
    expect(res.body).toMatchObject({ courseId: id, status: "enrolled" });
    const course = (await api().get(`/api/lms/courses/${id}`).set(auth(alice.token))).body;
    expect(course.myEnrollment).toBe("enrolled");
    expect(course.enrolled).toBe(1);
    // Tham gia lại không tăng sĩ số
    await api().post(`/api/lms/courses/${id}/join`).set(auth(alice.token)).send({}).expect(200);
    expect((await api().get(`/api/lms/courses/${id}`).set(auth(alice.token))).body.enrolled).toBe(1);
  });

  it("only students can join", async () => {
    const id = await createCourse("Chỉ học viên");
    expect((await api().post(`/api/lms/courses/${id}/join`).set(auth(otherLecturer.token)).send({})).status).toBe(403);
  });
});

describe("approval course", () => {
  let id: number;
  beforeAll(async () => {
    id = await createCourse("Khóa cần duyệt", { enrollmentMethod: "approval" });
  });

  it("creates a pending request that the owner approves", async () => {
    const res = await api().post(`/api/lms/courses/${id}/join`).set(auth(alice.token)).send({ message: "Cho em vào" });
    expect(res.body.status).toBe("pending");
    expect((await api().get(`/api/lms/courses/${id}`).set(auth(alice.token))).body.myEnrollment).toBe("pending");

    // Chưa được duyệt thì chưa xem được bài học / không phải người khác duyệt
    expect((await api().get(`/api/lms/courses/${id}/enrollment-requests`).set(auth(otherLecturer.token))).status).toBe(403);
    expect((await api().get(`/api/lms/courses/${id}/enrollment-requests`).set(auth(alice.token))).status).toBe(403);

    const list = await api().get(`/api/lms/courses/${id}/enrollment-requests`).set(auth(owner.token));
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ learnerId: alice.id, message: "Cho em vào", status: "pending" });

    const decided = await api()
      .post(`/api/lms/enrollment-requests/${list.body[0].id}/decision`)
      .set(auth(owner.token))
      .send({ decision: "approve" });
    expect(decided.body.status).toBe("approved");
    expect((await api().get(`/api/lms/courses/${id}`).set(auth(alice.token))).body.myEnrollment).toBe("enrolled");

    const again = await api()
      .post(`/api/lms/enrollment-requests/${list.body[0].id}/decision`)
      .set(auth(owner.token))
      .send({ decision: "reject" });
    expect(again.status).toBe(409);
  });

  it("supports withdraw, reject and re-request", async () => {
    await api().post(`/api/lms/courses/${id}/join`).set(auth(bob.token)).send({}).expect(200);
    await api().delete(`/api/lms/courses/${id}/join`).set(auth(bob.token)).expect(200);
    expect((await api().delete(`/api/lms/courses/${id}/join`).set(auth(bob.token))).status).toBe(404);

    await api().post(`/api/lms/courses/${id}/join`).set(auth(bob.token)).send({}).expect(200);
    const [req] = (await api().get(`/api/lms/courses/${id}/enrollment-requests`).set(auth(owner.token))).body;
    await api().post(`/api/lms/enrollment-requests/${req.id}/decision`).set(auth(owner.token)).send({ decision: "reject" }).expect(200);
    expect((await api().get(`/api/lms/courses/${id}`).set(auth(bob.token))).body.myEnrollment).toBe("none");

    const retry = await api().post(`/api/lms/courses/${id}/join`).set(auth(bob.token)).send({});
    expect(retry.body.status).toBe("pending");
  });
});

describe("private course and invites", () => {
  let id: number;
  beforeAll(async () => {
    id = await createCourse("Khóa riêng tư", { visibility: "private" });
  });

  it("is hidden from students who are not enrolled", async () => {
    expect(await listIds(alice)).not.toContain(id);
    expect((await api().get(`/api/lms/courses/${id}`).set(auth(alice.token))).status).toBe(404);
    expect((await api().get(`/api/lms/courses/${id}/outline`).set(auth(alice.token))).status).toBe(404);
    expect((await api().post(`/api/lms/courses/${id}/join`).set(auth(alice.token)).send({})).status).toBe(404);
  });

  it("only managers manage invites, and expiry must be in the future", async () => {
    expect((await api().post(`/api/lms/courses/${id}/invites`).set(auth(otherLecturer.token)).send({})).status).toBe(403);
    const past = new Date(Date.now() - 60_000).toISOString();
    expect((await api().post(`/api/lms/courses/${id}/invites`).set(auth(owner.token)).send({ expiresAt: past })).status).toBe(400);
  });

  it("enrolls through an invite link with a use limit", async () => {
    const created = await api()
      .post(`/api/lms/courses/${id}/invites`)
      .set(auth(owner.token))
      .send({ expiresAt: new Date(Date.now() + 86_400_000).toISOString(), maxUses: 1 });
    expect(created.status).toBe(201);
    const { token } = created.body;

    const preview = await api().get(`/api/lms/invite-links/${token}`).set(auth(alice.token));
    expect(preview.body).toMatchObject({ courseId: id, courseTitle: "Khóa riêng tư", valid: true, alreadyEnrolled: false });

    const accepted = await api().post(`/api/lms/invite-links/${token}`).set(auth(alice.token));
    expect(accepted.body.status).toBe("enrolled");
    expect(await listIds(alice)).toContain(id);
    expect((await api().get(`/api/lms/courses/${id}`).set(auth(alice.token))).status).toBe(200);

    // Đã dùng hết lượt
    const full = await api().get(`/api/lms/invite-links/${token}`).set(auth(bob.token));
    expect(full.body.valid).toBe(false);
    expect((await api().post(`/api/lms/invite-links/${token}`).set(auth(bob.token))).status).toBe(410);

    const invites = (await api().get(`/api/lms/courses/${id}/invites`).set(auth(owner.token))).body;
    expect(invites[0]).toMatchObject({ uses: 1, maxUses: 1, active: false, revoked: false });
  });

  it("rejects revoked and unknown links", async () => {
    const created = await api().post(`/api/lms/courses/${id}/invites`).set(auth(owner.token)).send({});
    await api().delete(`/api/lms/invites/${created.body.id}`).set(auth(owner.token)).expect(200);
    expect((await api().post(`/api/lms/invite-links/${created.body.token}`).set(auth(carol.token))).status).toBe(410);
    expect((await api().get(`/api/lms/invite-links/khongTonTaiLienKetNay123`).set(auth(carol.token))).status).toBe(404);
    expect(await listIds(carol)).not.toContain(id);
  });
});
