export interface CourseMaterial {
  id: string;
  courseId: number;
  lessonNumber?: number;
  title: string;
  type: 'pdf' | 'doc' | 'slide' | 'video' | 'link';
  fileUrl: string;
  fileName?: string;
  fileSize?: string;
  description?: string;
  uploadedBy: string;
  uploadedAt: string;
  downloadCount: number;
}

export interface CourseAssignment {
  id: string;
  courseId: number;
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
  attachmentUrl?: string;
  attachmentName?: string;
  createdBy: string;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: number;
  studentName: string;
  studentAvatar: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  textContent?: string;
  submittedAt: string;
  status: 'submitted' | 'graded';
  grade?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
}

const STORAGE_KEYS = {
  MATERIALS: 'lms_materials_data',
  ASSIGNMENTS: 'lms_assignments_data',
  SUBMISSIONS: 'lms_submissions_data',
};

// Dữ liệu mẫu khởi tạo (chuẩn Moodle)
const INITIAL_MATERIALS: CourseMaterial[] = [
  {
    id: 'mat-1',
    courseId: 1,
    lessonNumber: 1,
    title: 'Đề cương chi tiết học phần & Kế hoạch giảng dạy',
    type: 'pdf',
    fileUrl: '/uploads/de-cuong-hoc-phan.pdf',
    fileName: 'De_cuong_hoc_phan_2026.pdf',
    fileSize: '1.2 MB',
    description: 'Bản mô tả chuẩn đầu ra, tài liệu tham khảo và cách tính điểm quá trình.',
    uploadedBy: 'Cô Bui Ngan',
    uploadedAt: '15-11-2026',
    downloadCount: 42,
  },
  {
    id: 'mat-2',
    courseId: 1,
    lessonNumber: 1,
    title: 'Bài giảng Slide Chương 1: Kỹ năng lắng nghe và giao tiếp tích cực',
    type: 'slide',
    fileUrl: '/uploads/slide-chuong-1.pdf',
    fileName: 'Slide_Chuong_1_Communication.pptx',
    fileSize: '4.8 MB',
    description: 'Slide trình chiếu bài giảng lớp lý thuyết tuần 1.',
    uploadedBy: 'Cô Bui Ngan',
    uploadedAt: '16-11-2026',
    downloadCount: 38,
  },
  {
    id: 'mat-3',
    courseId: 1,
    lessonNumber: 2,
    title: 'Tài liệu đọc thêm: 10 Nguyên tắc giải quyết mâu thuẫn trong làm việc nhóm',
    type: 'doc',
    fileUrl: '/uploads/tai-lieu-doc-them.pdf',
    fileName: 'Tai_Lieu_Doc_Them_Teamwork.docx',
    fileSize: '850 KB',
    description: 'Tài liệu chuyên khảo được trích xuất từ giáo trình đào tạo nội bộ.',
    uploadedBy: 'Cô Bui Ngan',
    uploadedAt: '18-11-2026',
    downloadCount: 29,
  },
  {
    id: 'mat-4',
    courseId: 1,
    lessonNumber: 2,
    title: 'Video minh họa tình huống thực tế: Xử lý khủng hoảng truyền thông',
    type: 'video',
    fileUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    fileName: 'Case_Study_Video.mp4',
    fileSize: 'Online Stream',
    description: 'Video phóng sự thực tế để học viên thảo luận nhóm.',
    uploadedBy: 'Cô Bui Ngan',
    uploadedAt: '19-11-2026',
    downloadCount: 51,
  },
  {
    id: 'mat-5',
    courseId: 2,
    lessonNumber: 1,
    title: 'Slide bài giảng: Các trường phái triết học cổ đại & cận đại',
    type: 'slide',
    fileUrl: '/uploads/slide-triet-hoc.pdf',
    fileName: 'Triet_Hoc_Dai_Cuong.pdf',
    fileSize: '3.1 MB',
    description: 'Tài liệu tóm tắt hệ thống các nhà tư tưởng chính.',
    uploadedBy: 'Thầy Nguyễn Văn A',
    uploadedAt: '10-11-2026',
    downloadCount: 65,
  },
];

const INITIAL_ASSIGNMENTS: CourseAssignment[] = [
  {
    id: 'asg-1',
    courseId: 1,
    title: 'Bài tập tuần 1: Phân tích tình huống xử lý khiếu nại khách hàng',
    description:
      'Học viên đọc kịch bản tình huống trong Slide Chương 1. Viết bài luận từ 500-1000 từ phân tích các bước lắng nghe và đưa ra 2 giải pháp xử lý. Nộp file PDF hoặc gõ trực tiếp.',
    dueDate: '2026-11-28',
    maxPoints: 10,
    attachmentName: 'Kich_ban_tinh_huong_mau.pdf',
    attachmentUrl: '/uploads/kich-ban.pdf',
    createdBy: 'Cô Bui Ngan',
    createdAt: '16-11-2026',
  },
  {
    id: 'asg-2',
    courseId: 1,
    title: 'Bài thu hoạch giữa kỳ: Xây dựng kế hoạch đào tạo kỹ năng cho tổ nhóm',
    description:
      'Lập kế hoạch đào tạo kéo dài 4 tuần cho một nhóm từ 5-10 người. Nêu rõ mục tiêu, nội dung từng buổi và phương thức đánh giá đầu ra.',
    dueDate: '2026-12-10',
    maxPoints: 10,
    attachmentName: 'Template_Ke_Hoach_Dao_Tao.docx',
    attachmentUrl: '/uploads/template.docx',
    createdBy: 'Cô Bui Ngan',
    createdAt: '19-11-2026',
  },
  {
    id: 'asg-3',
    courseId: 2,
    title: 'Bài luận: Mối quan hệ giữa vật chất và ý thức trong đời sống số',
    description: 'Phân tích quan điểm triết học áp dụng vào kỷ nguyên trí tuệ nhân tạo (AI). Độ dài tối thiểu 800 từ.',
    dueDate: '2026-12-05',
    maxPoints: 10,
    createdBy: 'Thầy Nguyễn Văn A',
    createdAt: '15-11-2026',
  },
];

const INITIAL_SUBMISSIONS: AssignmentSubmission[] = [
  {
    id: 'sub-1',
    assignmentId: 'asg-1',
    studentId: 3,
    studentName: 'Ngann',
    studentAvatar: 'NG',
    fileName: 'Bai_Tap_Tuan_1_Ngann.pdf',
    fileSize: '450 KB',
    textContent:
      'Kính gửi Cô Bui Ngan, em đã hoàn thành bài phân tích tình huống với 3 phương án xử lý theo nguyên tắc 5 bước lắng nghe tích cực.',
    submittedAt: '18-11-2026 14:30',
    status: 'graded',
    grade: 9.5,
    feedback: 'Bài làm rất tốt, phân tích thấu đáo và lập luận chặt chẽ. Cần phát huy ở bài tập lớn!',
    gradedBy: 'Cô Bui Ngan',
    gradedAt: '19-11-2026 09:15',
  },
  {
    id: 'sub-2',
    assignmentId: 'asg-1',
    studentId: 4,
    studentName: 'Nguyễn Tú',
    studentAvatar: 'NT',
    fileName: 'Phan_Tich_Khach_Hang_NguyenTu.pdf',
    fileSize: '620 KB',
    textContent:
      'Em xin gửi cô bài làm phân tích tình huống số 2 về xử lý xung đột trong dịch vụ hỗ trợ. Em có bổ sung mô hình thang đo độ hài lòng.',
    submittedAt: '21-11-2026 10:15',
    status: 'submitted',
  },
  {
    id: 'sub-3',
    assignmentId: 'asg-1',
    studentId: 5,
    studentName: 'Trần Mỹ Uyên',
    studentAvatar: 'TU',
    fileName: 'BaiTap_Tuan1_MyUyen.docx',
    fileSize: '310 KB',
    textContent:
      'Kính gửi cô, bài nộp của em đính kèm sơ đồ 4 bước thấu cảm của mô hình giải quyết khiếu nại khách hàng khó tính.',
    submittedAt: '21-11-2026 14:05',
    status: 'submitted',
  },
  {
    id: 'sub-4',
    assignmentId: 'asg-2',
    studentId: 6,
    studentName: 'Vũ Thành Đạt',
    studentAvatar: 'VD',
    fileName: 'Ke_Hoach_Dao_Tao_ThanhDat.pdf',
    fileSize: '1.1 MB',
    textContent:
      'Kế hoạch đào tạo kỹ năng làm việc nhóm Agile trong vòng 4 tuần dành cho tổ dự án nội bộ.',
    submittedAt: '21-11-2026 16:40',
    status: 'submitted',
  },
];

const API_BASE = '/api';

class LmsStorageService {
  // --- SYNC VỚI BACKEND REST API ---
  async fetchMaterials(courseId: number): Promise<CourseMaterial[]> {
    try {
      const res = await fetch(`${API_BASE}/courses/${courseId}/materials`);
      if (res.ok) {
        const data: CourseMaterial[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const all = this.getMaterials().filter(m => m.courseId !== courseId);
          const updated = [...data, ...all];
          localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(updated));
          return data;
        }
      }
    } catch (e) {
      console.warn('Không thể tải tài liệu từ backend, dùng cache cục bộ', e);
    }
    return this.getMaterials(courseId);
  }

  async fetchAssignments(courseId: number): Promise<CourseAssignment[]> {
    try {
      const res = await fetch(`${API_BASE}/courses/${courseId}/assignments`);
      if (res.ok) {
        const data: CourseAssignment[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const all = this.getAssignments().filter(a => a.courseId !== courseId);
          const updated = [...data, ...all];
          localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(updated));
          return data;
        }
      }
    } catch (e) {
      console.warn('Không thể tải bài tập từ backend, dùng cache cục bộ', e);
    }
    return this.getAssignments(courseId);
  }

  async fetchSubmissions(assignmentId: string): Promise<AssignmentSubmission[]> {
    try {
      const res = await fetch(`${API_BASE}/assignments/${assignmentId}/subs`);
      if (res.ok) {
        const data: AssignmentSubmission[] = await res.json();
        if (Array.isArray(data)) {
          const all = this.getSubmissions().filter(s => s.assignmentId !== assignmentId);
          const updated = [...data, ...all];
          localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(updated));
          return data;
        }
      }
    } catch (e) {
      console.warn('Không thể tải bài nộp từ backend, dùng cache cục bộ', e);
    }
    return this.getSubmissions(assignmentId);
  }

  async syncWithBackend(courseId?: number): Promise<void> {
    if (!courseId) return;
    try {
      await Promise.allSettled([
        this.fetchMaterials(courseId),
        this.fetchAssignments(courseId),
      ]);
    } catch (e) {
      console.warn('Lỗi đồng bộ dữ liệu với server', e);
    }
  }

  // --- MATERIALS ---
  getMaterials(courseId?: number): CourseMaterial[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MATERIALS);
      const items: CourseMaterial[] = raw ? JSON.parse(raw) : INITIAL_MATERIALS;
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(INITIAL_MATERIALS));
      }
      return courseId ? items.filter(m => m.courseId === courseId) : items;
    } catch {
      return INITIAL_MATERIALS;
    }
  }

  addMaterial(material: Omit<CourseMaterial, 'id' | 'uploadedAt' | 'downloadCount'>): CourseMaterial {
    const items = this.getMaterials();
    const tempId = `mat-${Date.now()}`;
    const newMaterial: CourseMaterial = {
      ...material,
      id: tempId,
      uploadedAt: new Date().toLocaleDateString('vi-VN'),
      downloadCount: 0,
    };
    items.unshift(newMaterial);
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(items));

    // Đồng bộ lên backend REST API
    fetch(`${API_BASE}/courses/${material.courseId}/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(material),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(serverItem => {
        if (serverItem) {
          const current = this.getMaterials().map(m => (m.id === tempId ? serverItem : m));
          localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(current));
        }
      })
      .catch(err => console.warn('Lỗi đồng bộ tài liệu lên server:', err));

    return newMaterial;
  }

  deleteMaterial(id: string): void {
    const items = this.getMaterials().filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(items));
    fetch(`${API_BASE}/materials/${id}`, { method: 'DELETE' }).catch(e => console.warn(e));
  }

  incrementDownload(id: string): void {
    const items = this.getMaterials().map(m => (m.id === id ? { ...m, downloadCount: m.downloadCount + 1 } : m));
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(items));
    fetch(`${API_BASE}/materials/${id}/download`, { method: 'POST' }).catch(e => console.warn(e));
  }

  // --- ASSIGNMENTS ---
  getAssignments(courseId?: number): CourseAssignment[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
      const items: CourseAssignment[] = raw ? JSON.parse(raw) : INITIAL_ASSIGNMENTS;
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
      }
      return courseId ? items.filter(a => a.courseId === courseId) : items;
    } catch {
      return INITIAL_ASSIGNMENTS;
    }
  }

  addAssignment(assignment: Omit<CourseAssignment, 'id' | 'createdAt'>): CourseAssignment {
    const items = this.getAssignments();
    const tempId = `asg-${Date.now()}`;
    const newAssignment: CourseAssignment = {
      ...assignment,
      id: tempId,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };
    items.unshift(newAssignment);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(items));

    fetch(`${API_BASE}/courses/${assignment.courseId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignment),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(serverItem => {
        if (serverItem) {
          const current = this.getAssignments().map(a => (a.id === tempId ? serverItem : a));
          localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(current));
        }
      })
      .catch(err => console.warn('Lỗi đồng bộ bài tập lên server:', err));

    return newAssignment;
  }

  deleteAssignment(id: string): void {
    const items = this.getAssignments().filter(a => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(items));
    fetch(`${API_BASE}/assignments/${id}`, { method: 'DELETE' }).catch(e => console.warn(e));
  }

  // --- SUBMISSIONS ---
  getSubmissions(assignmentId?: string): AssignmentSubmission[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      let items: AssignmentSubmission[] = raw ? JSON.parse(raw) : INITIAL_SUBMISSIONS;
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(INITIAL_SUBMISSIONS));
      } else {
        const existingIds = new Set(items.map(s => s.id));
        const missing = INITIAL_SUBMISSIONS.filter(s => !existingIds.has(s.id));
        if (missing.length > 0) {
          items = [...items, ...missing];
          localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(items));
        }
      }
      return assignmentId ? items.filter(s => s.assignmentId === assignmentId) : items;
    } catch {
      return INITIAL_SUBMISSIONS;
    }
  }

  getStudentSubmission(assignmentId: string, studentId: number): AssignmentSubmission | undefined {
    return this.getSubmissions(assignmentId).find(s => s.studentId === studentId);
  }

  submitAssignment(
    data: Omit<AssignmentSubmission, 'id' | 'submittedAt' | 'status' | 'grade' | 'feedback' | 'gradedBy' | 'gradedAt'>
  ): AssignmentSubmission {
    const items = this.getSubmissions();
    const existingIndex = items.findIndex(s => s.assignmentId === data.assignmentId && s.studentId === data.studentId);
    const tempId = existingIndex >= 0 ? items[existingIndex]!.id : `sub-${Date.now()}`;

    const submission: AssignmentSubmission = {
      ...data,
      id: tempId,
      submittedAt: new Date().toLocaleString('vi-VN'),
      status: 'submitted',
    };

    if (existingIndex >= 0) {
      items[existingIndex] = submission;
    } else {
      items.unshift(submission);
    }

    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(items));

    fetch(`${API_BASE}/assignments/${data.assignmentId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(serverSub => {
        if (serverSub) {
          const current = this.getSubmissions().map(s => (s.id === tempId ? serverSub : s));
          localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(current));
        }
      })
      .catch(err => console.warn('Lỗi đồng bộ bài nộp lên server:', err));

    return submission;
  }

  gradeSubmission(submissionId: string, grade: number, feedback: string, teacherName: string): AssignmentSubmission | null {
    const items = this.getSubmissions();
    const index = items.findIndex(s => s.id === submissionId);
    if (index === -1) return null;

    items[index] = {
      ...items[index]!,
      status: 'graded',
      grade,
      feedback,
      gradedBy: teacherName,
      gradedAt: new Date().toLocaleString('vi-VN'),
    };

    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(items));

    fetch(`${API_BASE}/submissions/${submissionId}/grade`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade, feedback, gradedBy: teacherName }),
    }).catch(e => console.warn('Lỗi lưu điểm lên server:', e));

    return items[index]!;
  }
}

export const lmsStorage = new LmsStorageService();
