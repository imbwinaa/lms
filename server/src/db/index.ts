import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), "lms.db");

export const sqlite = new Database(dbPath);

// Tối ưu hiệu năng và kiểm tra khóa ngoại (Foreign Keys)
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Tự động khởi tạo cấu trúc bảng SQLite nếu chưa tồn tại
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS lms_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT NOT NULL,
    duration TEXT NOT NULL,
    lessons INTEGER NOT NULL,
    enrolled INTEGER NOT NULL DEFAULT 0,
    progress REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Đang hoạt động',
    format TEXT NOT NULL DEFAULT 'Native',
    accent TEXT NOT NULL DEFAULT 'teal',
    instructor_name TEXT NOT NULL DEFAULT 'Cô Bui Ngan',
    instructor_id INTEGER REFERENCES lms_learners(id) ON DELETE SET NULL,
    media_url TEXT,
    media_type TEXT DEFAULT 'video'
  );

  CREATE TABLE IF NOT EXISTS lms_learners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    team TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    progress REAL NOT NULL DEFAULT 0,
    active_course TEXT NOT NULL DEFAULT 'Chưa ghi danh',
    last_active TEXT NOT NULL DEFAULT 'Chưa hoạt động'
  );

  CREATE TABLE IF NOT EXISTS lms_learning_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    courses INTEGER NOT NULL,
    course_titles TEXT NOT NULL DEFAULT '[]',
    duration TEXT NOT NULL,
    completion REAL NOT NULL DEFAULT 0,
    learners INTEGER NOT NULL DEFAULT 0,
    accent TEXT NOT NULL DEFAULT 'teal'
  );

  CREATE TABLE IF NOT EXISTS lms_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    learner_id INTEGER NOT NULL REFERENCES lms_learners(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'Đang học',
    completed_lesson_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS lms_enrollments_learner_course_unique ON lms_enrollments(learner_id, course_id);

  CREATE TABLE IF NOT EXISTS lms_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    learner TEXT NOT NULL,
    course TEXT NOT NULL,
    serial TEXT NOT NULL UNIQUE,
    issued_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Đã cấp'
  );

  CREATE TABLE IF NOT EXISTS lms_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    time TEXT NOT NULL,
    kind TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lms_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    learner_id INTEGER NOT NULL REFERENCES lms_learners(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    awarded_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS lms_badges_learner_name_unique ON lms_badges(learner_id, name);

  CREATE TABLE IF NOT EXISTS lms_xapi_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    learner_id INTEGER NOT NULL REFERENCES lms_learners(id) ON DELETE CASCADE,
    verb TEXT NOT NULL,
    object_id TEXT NOT NULL,
    score REAL NOT NULL,
    timestamp TEXT NOT NULL,
    raw TEXT
  );

  CREATE TABLE IF NOT EXISTS lms_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES lms_learners(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lms_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    lesson_number INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'pdf',
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size TEXT,
    description TEXT,
    uploaded_by TEXT NOT NULL DEFAULT 'Cô Bui Ngan',
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS lms_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT NOT NULL,
    max_points REAL NOT NULL DEFAULT 10,
    attachment_url TEXT,
    attachment_name TEXT,
    created_by TEXT NOT NULL DEFAULT 'Cô Bui Ngan',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );

  CREATE TABLE IF NOT EXISTS lms_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES lms_assignments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES lms_learners(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL DEFAULT 'Ngann',
    student_avatar TEXT NOT NULL DEFAULT 'NG',
    file_url TEXT,
    file_name TEXT,
    file_size TEXT,
    text_content TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    grade REAL,
    feedback TEXT,
    graded_by TEXT,
    graded_at TEXT,
    submitted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS lms_submissions_assignment_student_unique ON lms_submissions(assignment_id, student_id);
`);

// Tự động nâng cấp bảng nếu database đã tồn tại từ trước
try { sqlite.exec("ALTER TABLE lms_courses ADD COLUMN instructor_name TEXT NOT NULL DEFAULT 'Cô Bui Ngan'"); } catch {}
try { sqlite.exec("ALTER TABLE lms_courses ADD COLUMN media_url TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE lms_courses ADD COLUMN media_type TEXT DEFAULT 'video'"); } catch {}
try { sqlite.exec("ALTER TABLE lms_learners ADD COLUMN role TEXT NOT NULL DEFAULT 'student'"); } catch {}
try { sqlite.exec("ALTER TABLE lms_learners ADD COLUMN password_hash TEXT"); } catch {}
try { sqlite.exec("ALTER TABLE lms_courses ADD COLUMN instructor_id INTEGER REFERENCES lms_learners(id) ON DELETE SET NULL"); } catch {}
sqlite.exec("CREATE INDEX IF NOT EXISTS lms_sessions_user_idx ON lms_sessions(user_id)");
sqlite.exec("CREATE INDEX IF NOT EXISTS lms_courses_instructor_idx ON lms_courses(instructor_id)");

export const db = drizzle(sqlite, { schema });

export * from "./schema";
