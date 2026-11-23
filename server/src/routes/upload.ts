import { Router } from "express";
import fs from "fs";
import path from "path";
import { IMMUTABLE_CACHE, isR2Configured, uploadFileToR2, getR2ObjectStream } from "../lib/r2";
import { badRequest, notFound, parseOr400 } from "../lib/http";
import { authenticate, requireRole } from "../middlewares/auth";
import { UploadFileBody } from "../schemas";

const uploadRouter = Router();
export const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Danh sách định dạng tệp được phép tải lên (theo phần mở rộng) */
const ALLOWED_EXTENSIONS: Record<string, "video" | "audio" | "document" | "scorm"> = {
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".ogg": "audio",
  ".pdf": "document",
  ".doc": "document",
  ".docx": "document",
  ".ppt": "document",
  ".pptx": "document",
  ".xls": "document",
  ".xlsx": "document",
  ".txt": "document",
  ".png": "document",
  ".jpg": "document",
  ".jpeg": "document",
  ".webp": "document",
  ".gif": "document",
  ".zip": "scorm",
};

export interface PresetMedia {
  id: string;
  title: string;
  type: "video" | "audio" | "document" | "scorm";
  url: string;
  duration: string;
  sizeText: string;
  format: string;
  description: string;
}

export const PRESET_MEDIA_LIBRARY: PresetMedia[] = [
  {
    id: "preset-video-1",
    title: "Kỹ năng lắng nghe & phản hồi tích cực trong giáo dục",
    type: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration: "03:15",
    sizeText: "14.2 MB",
    format: "H5P / MP4",
    description: "Video bài giảng mẫu chuẩn HD kèm phụ đề tiếng Việt và bài tập tương tác tương thích mọi thiết bị.",
  },
  {
    id: "preset-video-2",
    title: "Bài giảng mẫu: Ứng dụng công nghệ số trong lớp học",
    type: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    duration: "09:56",
    sizeText: "28.5 MB",
    format: "Native / MP4",
    description: "Video trực quan giúp học sinh tiếp thu kiến thức sinh động qua các ví dụ thực tế.",
  },
  {
    id: "preset-audio-1",
    title: "Luyện phát âm & Ngữ điệu sư phạm chuẩn",
    type: "audio",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: "06:12",
    sizeText: "4.8 MB",
    format: "Audio MP3",
    description: "File ghi âm giọng đọc chuẩn phục vụ rèn luyện phát âm và kỹ năng thuyết trình sư phạm.",
  },
  {
    id: "preset-doc-1",
    title: "Khung năng lực số dành cho cán bộ quản lý giáo dục 2026.pdf",
    type: "document",
    url: "/uploads/khung-nang-luc-so-2026.pdf",
    duration: "18 trang",
    sizeText: "2.1 MB",
    format: "Tài liệu PDF",
    description: "Bộ tiêu chuẩn phương pháp giảng dạy tích hợp và hướng dẫn chuyển đổi số trường học.",
  },
  {
    id: "preset-scorm-1",
    title: "Gói bài giảng tương tác SCORM 1.2 - Xử lý tình huống học đường",
    type: "scorm",
    url: "/uploads/scorm-tinh-huong-hoc-duong.zip",
    duration: "45 phút",
    sizeText: "8.5 MB",
    format: "SCORM 1.2",
    description: "Gói bài giảng tương tác chuẩn quốc tế tự động báo cáo điểm số về bảng điều khiển giáo viên.",
  },
];

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Proxy stream từ R2 (công khai: URL được nhúng trực tiếp vào <video>/<a>)
uploadRouter.get("/r2/:key", async (req, res) => {
  const range = typeof req.headers.range === "string" && /^bytes=\d*-\d*$/.test(req.headers.range) ? req.headers.range : undefined;
  let object: Awaited<ReturnType<typeof getR2ObjectStream>>;
  try {
    object = await getR2ObjectStream(String(req.params.key), range);
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 416) {
      res.status(416).end();
      return;
    }
    res.status(404).json({ message: "Không tìm thấy file trên Cloudflare R2." });
    return;
  }
  if (object.ContentRange) {
    res.status(206);
    res.setHeader("Content-Range", object.ContentRange);
  }
  if (object.ContentType) res.setHeader("Content-Type", object.ContentType);
  if (object.ContentLength !== undefined) res.setHeader("Content-Length", object.ContentLength);
  if (object.ETag) res.setHeader("ETag", object.ETag);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", IMMUTABLE_CACHE);
  const body = object.Body as NodeJS.ReadableStream | undefined;
  if (!body) {
    res.end();
    return;
  }
  // Người xem đóng tab / tua đi chỗ khác -> dừng tải từ R2
  res.on("close", () => (body as unknown as { destroy?: () => void }).destroy?.());
  body.pipe(res);
});

// Các endpoint còn lại yêu cầu đăng nhập
uploadRouter.use(authenticate);

uploadRouter.get("/presets", (_req, res) => {
  res.json(PRESET_MEDIA_LIBRARY);
});

uploadRouter.post("/", async (req, res) => {
  const { presetId, name, type, data } = parseOr400(UploadFileBody, req.body);

  if (presetId) {
    const preset = PRESET_MEDIA_LIBRARY.find((p) => p.id === presetId);
    if (!preset) throw notFound("Không tìm thấy học liệu mẫu yêu cầu.");
    res.status(201).json({
      url: preset.url,
      fileName: preset.title,
      fileType: preset.type,
      sizeText: preset.sizeText,
      presetId: preset.id,
      storage: "preset",
    });
    return;
  }

  if (!name || !data) throw badRequest("Vui lòng cung cấp dữ liệu file hoặc chọn học liệu mẫu.");

  const cleanName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const extension = path.extname(cleanName).toLowerCase();
  const fileType = ALLOWED_EXTENSIONS[extension];
  if (!fileType) {
    throw badRequest(`Định dạng tệp "${extension || "không rõ"}" không được hỗ trợ.`);
  }

  const base64Data = data.includes("base64,") ? data.split("base64,")[1]! : data;
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length === 0) throw badRequest("Tệp rỗng hoặc dữ liệu không hợp lệ.");
  if (buffer.length > MAX_UPLOAD_BYTES) {
    res.status(413).json({ message: `Tệp vượt quá giới hạn ${formatSize(MAX_UPLOAD_BYTES)}.` });
    return;
  }

  const uniqueFileName = `${Date.now()}-${cleanName}`;
  let url = "";
  let storage: "cloudflare_r2" | "local" = "local";

  if (isR2Configured) {
    try {
      url = (await uploadFileToR2(cleanName, buffer, type || "application/octet-stream")).url;
      storage = "cloudflare_r2";
    } catch (error) {
      req.log.warn({ err: error }, "[R2] Lỗi tải lên Cloudflare R2, dùng lưu trữ cục bộ");
    }
  }
  if (storage === "local") {
    await fs.promises.writeFile(path.join(uploadsDir, uniqueFileName), buffer);
    url = `/uploads/${uniqueFileName}`;
  }

  res.status(201).json({
    url,
    fileName: uniqueFileName,
    originalName: name,
    fileType,
    fileSize: buffer.length,
    sizeText: formatSize(buffer.length),
    storage,
  });
});

uploadRouter.get("/recent", requireRole("admin"), async (_req, res) => {
  const files = await fs.promises.readdir(uploadsDir);
  const details = await Promise.all(
    files.map(async (file) => {
      try {
        const stats = await fs.promises.stat(path.join(uploadsDir, file));
        if (!stats.isFile()) return null;
        return { fileName: file, url: `/uploads/${file}`, size: stats.size, createdAt: stats.birthtime.toISOString() };
      } catch {
        return null;
      }
    }),
  );
  res.json(details.filter(Boolean));
});

export default uploadRouter;
