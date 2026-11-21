import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { isR2Configured, uploadFileToR2, getR2ObjectStream } from "../lib/r2";

const uploadRouter = Router();
const uploadsDir = path.resolve(process.cwd(), "uploads");

// Đảm bảo thư mục uploads tồn tại
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// 1. DANH SÁCH HỌC LIỆU MẪU (PRESET MEDIA LIBRARY)
uploadRouter.get("/presets", (_req: Request, res: Response) => {
  return res.json({
    success: true,
    presets: PRESET_MEDIA_LIBRARY,
  });
});

// 2. TẢI FILE LÊN MÁY CHỦ LOCALHOST HOẶC CHỌN PRESET
uploadRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, type, size, data, presetId } = req.body;

    // Nếu người dùng chọn từ Kho học liệu mẫu
    if (presetId) {
      const preset = PRESET_MEDIA_LIBRARY.find(p => p.id === presetId);
      if (!preset) {
        return res.status(404).json({ success: false, message: "Không tìm thấy học liệu mẫu yêu cầu." });
      }
      return res.json({
        success: true,
        message: `Đã liên kết học liệu mẫu: ${preset.title}`,
        url: preset.url,
        fileName: preset.title,
        fileType: preset.type,
        sizeText: preset.sizeText,
        presetId: preset.id,
      });
    }

    // Nếu người dùng tải file lên từ máy tính
    if (!name || !data) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp dữ liệu file hoặc chọn học liệu mẫu.",
      });
    }

    // Làm sạch tên file và thêm timestamp để tránh trùng lặp
    const cleanName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${Date.now()}-${cleanName}`;
    const targetFilePath = path.join(uploadsDir, uniqueFileName);

    // Chuyển đổi base64 data URL thành Buffer
    const base64Data = data.includes("base64,") ? data.split("base64,")[1] : data;
    const buffer = Buffer.from(base64Data, "base64");

    // Ghi file cục bộ dự phòng
    await fs.promises.writeFile(targetFilePath, buffer);

    let finalUrl = `/uploads/${uniqueFileName}`;
    let isCloudflare = false;

    // Tự động tải lên Cloudflare R2 nếu đã cấu hình
    if (isR2Configured) {
      try {
        const r2Result = await uploadFileToR2(cleanName, buffer, type || "application/octet-stream");
        finalUrl = r2Result.url;
        isCloudflare = true;
      } catch (r2Err) {
        console.warn("[R2] Lỗi tải lên Cloudflare R2, dùng fallback cục bộ:", r2Err);
      }
    }

    const detectedType = type?.startsWith("video/")
      ? "video"
      : type?.startsWith("audio/")
      ? "audio"
      : type === "application/pdf"
      ? "document"
      : name.endsWith(".zip")
      ? "scorm"
      : "video";

    return res.status(201).json({
      success: true,
      message: isCloudflare
        ? `Đã lưu file "${cleanName}" thành công lên Cloudflare R2.`
        : `Đã lưu file "${cleanName}" thành công vào máy chủ.`,
      url: finalUrl,
      fileName: uniqueFileName,
      originalName: name,
      fileType: detectedType,
      fileSize: buffer.length,
      storage: isCloudflare ? "cloudflare_r2" : "local",
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Lỗi tải file lên:", error);
    return res.status(500).json({
      success: false,
      message: "Chưa thể lưu file lên máy chủ. Vui lòng thử lại.",
    });
  }
});

// 3. DANH SÁCH CÁC FILE ĐÃ TẢI LÊN GẦN ĐÂY TRÊN LOCALHOST
uploadRouter.get("/recent", async (_req: Request, res: Response) => {
  try {
    const files = await fs.promises.readdir(uploadsDir);
    const details = await Promise.all(
      files.map(async file => {
        try {
          const stats = await fs.promises.stat(path.join(uploadsDir, file));
          return {
            fileName: file,
            url: `/uploads/${file}`,
            size: stats.size,
            createdAt: stats.birthtime,
          };
        } catch {
          return null;
        }
      })
    );

    return res.json({
      success: true,
      files: details.filter(Boolean),
    });
  } catch (error) {
    console.error("Lỗi liệt kê file:", error);
    return res.status(500).json({ success: false, message: "Lỗi đọc danh sách file." });
  }
});

// 4. STREAMING PROXY TỪ R2 CHO TRÌNH DUYỆT (KHI CẦN)
uploadRouter.get("/r2/:key", async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    const object = await getR2ObjectStream(key);
    if (object.ContentType) {
      res.setHeader("Content-Type", object.ContentType);
    }
    if (object.ContentLength) {
      res.setHeader("Content-Length", object.ContentLength);
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    (object.Body as any)?.pipe(res);
  } catch (error) {
    console.error("Lỗi stream file từ R2:", error);
    res.status(404).send("Không tìm thấy file trên Cloudflare R2.");
  }
});

export default uploadRouter;
