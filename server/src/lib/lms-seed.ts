import { asc, count, eq, isNull } from "drizzle-orm";
import {
  db,
  lmsActivitiesTable,
  lmsAssignmentsTable,
  lmsBadgesTable,
  lmsCertificatesTable,
  lmsCoursesTable,
  lmsEnrollmentsTable,
  lmsLearnersTable,
  lmsLearningPathsTable,
  lmsMaterialsTable,
  lmsSubmissionsTable,
  lmsXapiEventsTable,
} from "../db";
import { hashPassword } from "./auth";
import { seedDemoOutlines } from "./demo-outline-seed";

/**
 * Chế độ khởi tạo dữ liệu:
 *  - Dữ liệu mẫu (SEED_DEMO_DATA=true — mặc định khi phát triển): khóa học, học viên,
 *    tài liệu, bài tập, chứng chỉ... minh họa; được bổ sung lại nếu thiếu.
 *  - Chỉ admin (SEED_DEMO_DATA không đặt/false — mặc định ở production): khi cơ sở dữ liệu
 *    chưa có tài khoản nào, chỉ tạo đúng 1 quản trị viên từ SEED_ADMIN_EMAIL + SEED_DEFAULT_PASSWORD.
 *    Không bao giờ chèn dữ liệu mẫu vào cơ sở dữ liệu thật.
 */
export function isDemoSeedEnabled(): boolean {
  const flag = process.env.SEED_DEMO_DATA?.trim().toLowerCase();
  if (flag) return flag === "true" || flag === "1";
  return process.env.NODE_ENV !== "production";
}

// Mật khẩu ban đầu của các tài khoản được khởi tạo. Bắt buộc đặt SEED_DEFAULT_PASSWORD ở production.
const seedPassword = process.env.SEED_DEFAULT_PASSWORD || "123456";
const defaultPasswordHash = hashPassword(seedPassword);

/** Chế độ chỉ admin: tạo quản trị viên đầu tiên nếu chưa có tài khoản nào */
async function seedFirstAdmin(): Promise<void> {
  const [accounts] = await db.select({ value: count() }).from(lmsLearnersTable);
  if (Number(accounts?.value ?? 0) > 0) return;

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.SEED_DEFAULT_PASSWORD ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(
      "Cơ sở dữ liệu chưa có tài khoản nào: hãy đặt SEED_ADMIN_EMAIL (email quản trị viên đầu tiên) " +
        "hoặc SEED_DEMO_DATA=true để dùng dữ liệu mẫu.",
    );
  }
  if (password.length < 8) {
    throw new Error("Hãy đặt SEED_DEFAULT_PASSWORD (≥ 8 ký tự) làm mật khẩu ban đầu cho quản trị viên đầu tiên.");
  }

  await db.insert(lmsLearnersTable).values({
    name: process.env.SEED_ADMIN_NAME?.trim() || "Quản trị viên",
    email,
    passwordHash: hashPassword(password),
    role: "admin",
    team: "Ban Giám Hiệu",
    points: 0,
    streak: 0,
    progress: 0,
    activeCourse: "Chưa ghi danh",
    lastActive: "Chưa hoạt động",
  });
}

function assertSafeSeedPassword() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_DEFAULT_PASSWORD) {
    throw new Error(
      "Cơ sở dữ liệu trống: hãy đặt biến môi trường SEED_DEFAULT_PASSWORD (≥ 8 ký tự) trước khi khởi tạo dữ liệu ở production, " +
        "nếu không tài khoản admin mẫu sẽ dùng mật khẩu công khai 123456.",
    );
  }
}

const courseSeed = [
  {
    title: "Hội nhập cùng Nova",
    description:
      "Hành trình làm quen với văn hóa, con người và cách làm việc tại Nova.",
    category: "Hội nhập",
    level: "Cơ bản",
    duration: "2 giờ 30 phút",
    lessons: 6,
    enrolled: 3,
    progress: 72,
    status: "Đang hoạt động",
    format: "H5P",
    accent: "teal",
    instructorName: "Cô Bui Ngan",
  },
  {
    title: "Lãnh đạo đội ngũ linh hoạt",
    description:
      "Xây dựng đội ngũ chủ động bằng phản hồi rõ ràng và tin cậy.",
    category: "Kỹ năng lãnh đạo",
    level: "Nâng cao",
    duration: "4 giờ",
    lessons: 8,
    enrolled: 2,
    progress: 54,
    status: "Đang hoạt động",
    format: "SCORM 1.2",
    accent: "violet",
    instructorName: "Cô Bui Ngan",
  },
  {
    title: "Bảo mật thông tin thực hành",
    description:
      "Nhận diện rủi ro thường gặp và xử lý an toàn trong công việc hằng ngày.",
    category: "Tuân thủ",
    level: "Cơ bản",
    duration: "1 giờ 45 phút",
    lessons: 5,
    enrolled: 3,
    progress: 89,
    status: "Đang hoạt động",
    format: "xAPI",
    accent: "amber",
    instructorName: "Cô Bui Ngan",
  },
];

const learnerSeed = [
  {
    name: "Cô Ngân Bùi",
    email: "ngan.bui@boom.vn",
    passwordHash: defaultPasswordHash,
    role: "admin",
    team: "Ban Giám Hiệu",
    points: 3200,
    streak: 30,
    progress: 100,
    activeCourse: "Quản trị đào tạo",
    lastActive: "Đang hoạt động",
  },
  {
    name: "Cô Bui Ngan",
    email: "bui.ngan@boom.vn",
    passwordHash: defaultPasswordHash,
    role: "lecturer",
    team: "Tổ Sư Phạm & Đào Tạo",
    points: 2800,
    streak: 25,
    progress: 95,
    activeCourse: "Hội nhập cùng Nova",
    lastActive: "Hôm nay, 10:15",
  },
  {
    name: "Ngann",
    email: "ngann@boom.vn",
    passwordHash: defaultPasswordHash,
    role: "student",
    team: "Lớp 10A",
    points: 1840,
    streak: 12,
    progress: 82,
    activeCourse: "Hội nhập cùng Nova",
    lastActive: "Hôm nay, 09:42",
  },
  {
    name: "Bui",
    email: "bui@boom.vn",
    passwordHash: defaultPasswordHash,
    role: "student",
    team: "Lớp 10A",
    points: 1620,
    streak: 8,
    progress: 76,
    activeCourse: "Lãnh đạo đội ngũ linh hoạt",
    lastActive: "Hôm nay, 08:15",
  },
  {
    name: "L",
    email: "l@boom.vn",
    passwordHash: defaultPasswordHash,
    role: "student",
    team: "Lớp 10B",
    points: 1480,
    streak: 16,
    progress: 91,
    activeCourse: "Bảo mật thông tin thực hành",
    lastActive: "Hôm qua, 16:30",
  },
];

const pathCourseSequences: Record<string, string[]> = {
  "Khởi đầu vững vàng": [
    "Hội nhập cùng Nova",
    "Bảo mật thông tin thực hành",
  ],
  "Từ chuyên viên đến quản lý": [
    "Bảo mật thông tin thực hành",
    "Hội nhập cùng Nova",
    "Lãnh đạo đội ngũ linh hoạt",
  ],
  "An toàn trong từng thao tác": ["Bảo mật thông tin thực hành"],
};

async function ensureXapiSampleEvents(
  learners: Array<{ id: number }>,
): Promise<void> {
  const existingEvents = await db
    .select({ id: lmsXapiEventsTable.id })
    .from(lmsXapiEventsTable)
    .limit(1);
  if (existingEvents.length > 0 || learners.length === 0) return;

  const xapiSeeds = Array.from({ length: 14 }, (_, index) => {
    const learnerId = learners[index % learners.length]!.id;
    const daysAgo = 6 - Math.floor(index / 2);
    const score = 72 + ((index * 7) % 29);
    const verb =
      index % 3 === 0
        ? "http://adlnet.gov/expapi/verbs/completed"
        : "http://adlnet.gov/expapi/verbs/experienced";
    return {
      learnerId,
      verb,
      objectId: `https://lms.nova.vn/activities/lesson-${index + 1}`,
      score,
      timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      raw: {
        actor: { learnerId },
        verb: index % 3 === 0 ? "completed" : "experienced",
        object: `lesson-${index + 1}`,
        result: { score: { raw: score, min: 0, max: 100 } },
      },
    };
  });
  await db.insert(lmsXapiEventsTable).values(xapiSeeds);
}

async function ensureMaterialsAndAssignments(
  courses: Array<{ id: number; title: string }>,
  learners: Array<{ id: number; name: string }>,
): Promise<void> {
  const existingMaterials = await db
    .select({ id: lmsMaterialsTable.id })
    .from(lmsMaterialsTable)
    .limit(1);

  const courseIds = new Map(courses.map((c) => [c.title, c.id]));
  const learnerIds = new Map(learners.map((l) => [l.name, l.id]));
  const firstCourseId = courses[0]?.id ?? 1;
  const secondCourseId = courses[1]?.id ?? firstCourseId;
  const onboardingId = courseIds.get("Hội nhập cùng Nova") ?? firstCourseId;
  const leadershipId = courseIds.get("Lãnh đạo đội ngũ linh hoạt") ?? secondCourseId;
  const ngannId = learnerIds.get("Ngann") ?? 3;

  if (existingMaterials.length === 0) {
    await db.insert(lmsMaterialsTable).values([
      {
        courseId: onboardingId,
        lessonNumber: 1,
        title: "Đề cương chi tiết học phần & Kế hoạch giảng dạy",
        type: "pdf",
        fileUrl: "/uploads/de-cuong-hoc-phan.pdf",
        fileName: "De_cuong_hoc_phan_2026.pdf",
        fileSize: "1.2 MB",
        description: "Bản mô tả chuẩn đầu ra, tài liệu tham khảo và cách tính điểm quá trình.",
        uploadedBy: "Cô Bui Ngan",
        downloadCount: 42,
      },
      {
        courseId: onboardingId,
        lessonNumber: 1,
        title: "Bài giảng Slide Chương 1: Kỹ năng lắng nghe và giao tiếp tích cực",
        type: "slide",
        fileUrl: "/uploads/slide-chuong-1.pdf",
        fileName: "Slide_Chuong_1_Communication.pptx",
        fileSize: "4.8 MB",
        description: "Slide trình chiếu bài giảng lớp lý thuyết tuần 1.",
        uploadedBy: "Cô Bui Ngan",
        downloadCount: 38,
      },
      {
        courseId: onboardingId,
        lessonNumber: 2,
        title: "Tài liệu đọc thêm: 10 Nguyên tắc giải quyết mâu thuẫn trong làm việc nhóm",
        type: "doc",
        fileUrl: "/uploads/tai-lieu-doc-them.pdf",
        fileName: "Tai_Lieu_Doc_Them_Teamwork.docx",
        fileSize: "850 KB",
        description: "Tài liệu chuyên khảo được trích xuất từ giáo trình đào tạo nội bộ.",
        uploadedBy: "Cô Bui Ngan",
        downloadCount: 29,
      },
      {
        courseId: onboardingId,
        lessonNumber: 2,
        title: "Video minh họa tình huống thực tế: Xử lý khủng hoảng truyền thông",
        type: "video",
        fileUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        fileName: "Case_Study_Video.mp4",
        fileSize: "Online Stream",
        description: "Video phóng sự thực tế để học viên thảo luận nhóm.",
        uploadedBy: "Cô Bui Ngan",
        downloadCount: 51,
      },
      {
        courseId: leadershipId,
        lessonNumber: 1,
        title: "Slide bài giảng: Các trường phái triết học & phong cách lãnh đạo",
        type: "slide",
        fileUrl: "/uploads/slide-triet-hoc.pdf",
        fileName: "Phong_Cach_Lanh_Dao_2026.pdf",
        fileSize: "3.1 MB",
        description: "Tài liệu tóm tắt hệ thống các lý thuyết quản trị hiện đại.",
        uploadedBy: "Cô Bui Ngan",
        downloadCount: 65,
      },
    ]);
  }

  const existingAssignments = await db
    .select({ id: lmsAssignmentsTable.id })
    .from(lmsAssignmentsTable)
    .limit(1);

  if (existingAssignments.length === 0) {
    const insertedAssignments = await db
      .insert(lmsAssignmentsTable)
      .values([
        {
          courseId: onboardingId,
          title: "Bài tập tuần 1: Phân tích tình huống xử lý khiếu nại khách hàng",
          description:
            "Học viên đọc kịch bản tình huống trong Slide Chương 1. Viết bài luận từ 500-1000 từ phân tích các bước lắng nghe và đưa ra 2 giải pháp xử lý. Nộp file PDF hoặc gõ trực tiếp.",
          dueDate: "2026-11-28",
          maxPoints: 10,
          attachmentName: "Kich_ban_tinh_huong_mau.pdf",
          attachmentUrl: "/uploads/kich-ban.pdf",
          createdBy: "Cô Bui Ngan",
        },
        {
          courseId: onboardingId,
          title: "Bài thu hoạch giữa kỳ: Xây dựng kế hoạch đào tạo kỹ năng cho tổ nhóm",
          description:
            "Lập kế hoạch đào tạo kéo dài 4 tuần cho một nhóm từ 5-10 người. Nêu rõ mục tiêu, nội dung từng buổi và phương thức đánh giá đầu ra.",
          dueDate: "2026-12-10",
          maxPoints: 10,
          attachmentName: "Template_Ke_Hoach_Dao_Tao.docx",
          attachmentUrl: "/uploads/template.docx",
          createdBy: "Cô Bui Ngan",
        },
        {
          courseId: leadershipId,
          title: "Bài luận: Mối quan hệ giữa lắng nghe và lãnh đạo trong kỷ nguyên số",
          description:
            "Phân tích quan điểm lãnh đạo phụng sự áp dụng vào kỷ nguyên trí tuệ nhân tạo (AI). Độ dài tối thiểu 800 từ.",
          dueDate: "2026-12-05",
          maxPoints: 10,
          createdBy: "Cô Bui Ngan",
        },
      ])
      .returning();

    const firstAssignment = insertedAssignments[0];
    if (firstAssignment) {
      const existingSubmissions = await db
        .select({ id: lmsSubmissionsTable.id })
        .from(lmsSubmissionsTable)
        .limit(1);

      if (existingSubmissions.length === 0) {
        await db.insert(lmsSubmissionsTable).values({
          assignmentId: firstAssignment.id,
          studentId: ngannId,
          studentName: "Ngann",
          studentAvatar: "NG",
          fileName: "Bai_Tap_Tuan_1_Ngann.pdf",
          fileSize: "450 KB",
          textContent:
            "Kính gửi Cô Bui Ngan, em đã hoàn thành bài phân tích tình huống với 3 phương án xử lý theo nguyên tắc 5 bước lắng nghe tích cực.",
          status: "graded",
          grade: 9.5,
          feedback:
            "Bài làm rất tốt, phân tích thấu đáo và lập luận chặt chẽ. Cần phát huy ở bài tập lớn!",
          gradedBy: "Cô Bui Ngan",
          gradedAt: "2026-11-19 09:15",
          submittedAt: "2026-11-18 14:30",
        });
      }
    }
  }
}

let seedPromise: Promise<void> | undefined;

async function seedLmsData(): Promise<void> {
  const existing = await db
    .select({ id: lmsCoursesTable.id })
    .from(lmsCoursesTable)
    .limit(1);
  if (existing.length > 0) {
    const learners = await db
      .select({ id: lmsLearnersTable.id, name: lmsLearnersTable.name, passwordHash: lmsLearnersTable.passwordHash })
      .from(lmsLearnersTable);
    for (const l of learners) {
      if (!l.passwordHash) {
        await db
          .update(lmsLearnersTable)
          .set({ passwordHash: defaultPasswordHash })
          .where(eq(lmsLearnersTable.id, l.id));
      }
    }
    await ensureXapiSampleEvents(learners);
    const paths = await db.select().from(lmsLearningPathsTable);
    for (const path of paths) {
      const courseTitles = pathCourseSequences[path.title];
      if (courseTitles && path.courseTitles.length === 0) {
        await db
          .update(lmsLearningPathsTable)
          .set({ courseTitles, courses: courseTitles.length })
          .where(eq(lmsLearningPathsTable.id, path.id));
      }
    }
    const courses = await db.select({ id: lmsCoursesTable.id, title: lmsCoursesTable.title }).from(lmsCoursesTable);
    await ensureMaterialsAndAssignments(courses, learners);
    return;
  }

  assertSafeSeedPassword();
  await db.insert(lmsCoursesTable).values(courseSeed);
  await db.insert(lmsLearnersTable).values(learnerSeed);
  await db.insert(lmsLearningPathsTable).values([
    {
      title: "Khởi đầu vững vàng",
      description: "Lộ trình hội nhập dành cho thành viên mới trong 30 ngày.",
      courses: 2,
      courseTitles: [
        "Hội nhập cùng Nova",
        "Bảo mật thông tin thực hành",
      ],
      duration: "6 giờ",
      completion: 78,
      learners: 3,
      accent: "teal",
    },
    {
      title: "Từ chuyên viên đến quản lý",
      description: "Phát triển năng lực dẫn dắt, giao việc và khai vấn đội ngũ.",
      courses: 3,
      courseTitles: [
        "Bảo mật thông tin thực hành",
        "Hội nhập cùng Nova",
        "Lãnh đạo đội ngũ linh hoạt",
      ],
      duration: "12 giờ",
      completion: 46,
      learners: 2,
      accent: "violet",
    },
    {
      title: "An toàn trong từng thao tác",
      description: "Các kiến thức tuân thủ cần thiết cho mọi phòng ban.",
      courses: 1,
      courseTitles: ["Bảo mật thông tin thực hành"],
      duration: "5 giờ",
      completion: 91,
      learners: 3,
      accent: "amber",
    },
  ]);

  const courses = await db.select().from(lmsCoursesTable);
  const learners = await db.select().from(lmsLearnersTable);
  const courseIds = new Map(courses.map((course) => [course.title, course.id]));
  const learnerIds = new Map(learners.map((learner) => [learner.name, learner.id]));

  const onboardingId = courseIds.get("Hội nhập cùng Nova");
  const leadershipId = courseIds.get("Lãnh đạo đội ngũ linh hoạt");
  const securityId = courseIds.get("Bảo mật thông tin thực hành");
  const ngannId = learnerIds.get("Ngann");
  const buiId = learnerIds.get("Bui");
  const lId = learnerIds.get("L");

  if (
    onboardingId !== undefined &&
    leadershipId !== undefined &&
    securityId !== undefined &&
    ngannId !== undefined &&
    buiId !== undefined &&
    lId !== undefined
  ) {
    await db.insert(lmsEnrollmentsTable).values([
      { learnerId: ngannId, courseId: onboardingId, completedLessonIds: ["intro", "culture"] },
      { learnerId: buiId, courseId: leadershipId, completedLessonIds: ["lead-1", "lead-2"] },
      { learnerId: lId, courseId: securityId, completedLessonIds: ["secure-1", "secure-2", "secure-3", "secure-4"] },
    ]);
  }

  await ensureXapiSampleEvents(learners);

  await db.insert(lmsCertificatesTable).values([
    {
      learner: "L",
      course: "Bảo mật thông tin thực hành",
      serial: "NOVA-2026-00124",
      issuedAt: "2026-11-10",
      status: "Đã cấp",
    },
    {
      learner: "Ngann",
      course: "Hội nhập cùng Nova",
      serial: "NOVA-2026-00123",
      issuedAt: "2026-11-08",
      status: "Đã cấp",
    },
    {
      learner: "Bui",
      course: "Lãnh đạo đội ngũ linh hoạt",
      serial: "NOVA-2026-00122",
      issuedAt: "2026-11-05",
      status: "Đã cấp",
    },
  ]);

  if (
    ngannId !== undefined &&
    buiId !== undefined &&
    lId !== undefined
  ) {
    await db.insert(lmsBadgesTable).values([
      {
        learnerId: ngannId,
        name: "Bứt phá tuần đầu",
        description: "Hoàn thành 5 bài học đầu tiên.",
        icon: "sparkles",
        awardedAt: "2026-11-02",
      },
      {
        learnerId: ngannId,
        name: "Người học bền bỉ",
        description: "Duy trì chuỗi học tập 7 ngày.",
        icon: "flame",
        awardedAt: "2026-11-05",
      },
      {
        learnerId: buiId,
        name: "Tư duy dẫn dắt",
        description: "Hoàn thành lộ trình quản lý.",
        icon: "compass",
        awardedAt: "2026-10-29",
      },
      {
        learnerId: lId,
        name: "Chuyên gia an toàn",
        description: "Đạt điểm tối đa trong bài kiểm tra tuân thủ.",
        icon: "shield",
        awardedAt: "2026-10-26",
      },
    ]);
  }

  await db.insert(lmsActivitiesTable).values([
    {
      title: "L vừa hoàn thành khóa học",
      detail: "Bảo mật thông tin thực hành · Chứng chỉ đã cấp",
      time: "12 phút trước",
      kind: "certificate",
    },
    {
      title: "Cô Bui Ngan vừa cập nhật bài giảng",
      detail: "Hội nhập cùng Nova · 6 bài học",
      time: "45 phút trước",
      kind: "quiz",
    },
    {
      title: "Ngann đạt huy hiệu mới",
      detail: "Người học bền bỉ · 120 điểm",
      time: "2 giờ trước",
      kind: "completion",
    },
    {
      title: "Bui vừa nộp câu trả lời Quiz",
      detail: "Lãnh đạo đội ngũ linh hoạt · 100 điểm",
      time: "3 giờ trước",
      kind: "quiz",
    },
  ]);

  await ensureMaterialsAndAssignments(courses, learners);
}

/**
 * Gán giảng viên phụ trách (instructor_id) cho các khóa học chưa có chủ sở hữu:
 * ưu tiên giảng viên trùng tên instructor_name, nếu không thì giảng viên đầu tiên.
 */
async function backfillCourseInstructors(): Promise<void> {
  const orphanCourses = await db
    .select({ id: lmsCoursesTable.id, instructorName: lmsCoursesTable.instructorName })
    .from(lmsCoursesTable)
    .where(isNull(lmsCoursesTable.instructorId));
  if (orphanCourses.length === 0) return;

  const lecturers = await db
    .select({ id: lmsLearnersTable.id, name: lmsLearnersTable.name })
    .from(lmsLearnersTable)
    .where(eq(lmsLearnersTable.role, "lecturer"))
    .orderBy(asc(lmsLearnersTable.id));
  const fallback = lecturers[0];
  if (!fallback) return;

  for (const course of orphanCourses) {
    const owner = lecturers.find((l) => l.name === course.instructorName) ?? fallback;
    await db
      .update(lmsCoursesTable)
      .set({ instructorId: owner.id, instructorName: owner.name })
      .where(eq(lmsCoursesTable.id, course.id));
  }
}

export function ensureLmsSeeded(): Promise<void> {
  if (!seedPromise) {
    // Dữ liệu mẫu (và gán giảng viên cho khóa mẫu) chỉ chạy ở chế độ demo;
    // ở chế độ thật, khóa học không có giảng viên là do admin chủ động gỡ — không tự gán lại.
    const run = isDemoSeedEnabled() ? seedLmsData().then(backfillCourseInstructors).then(seedDemoOutlines) : seedFirstAdmin();
    seedPromise = run.catch((error: unknown) => {
      seedPromise = undefined;
      throw error;
    });
  }
  return seedPromise;
}
