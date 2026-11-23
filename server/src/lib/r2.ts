import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const bucketName = process.env.R2_BUCKET_NAME || "lms-media";
const rawPublicUrl = (process.env.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export const isR2Configured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName);

export const r2Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  : null;

/**
 * Tải file buffer lên Cloudflare R2 và trả về đường dẫn URL
 */
export async function uploadFileToR2(
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; key: string }> {
  if (!r2Client) {
    throw new Error("Cloudflare R2 chưa được cấu hình các biến môi trường.");
  }

  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueKey = `${Date.now()}-${cleanName}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      Body: buffer,
      ContentType: contentType,
      // Khóa luôn duy nhất (timestamp) -> nội dung tại một URL không bao giờ đổi: cache vĩnh viễn
      CacheControl: IMMUTABLE_CACHE,
    })
  );

  // Có custom domain / r2.dev công khai: trình duyệt tải thẳng từ Cloudflare (không tốn băng thông máy chủ).
  // Không có: đi qua proxy /api/upload/r2/:key — URL cố định (presigned URL hết hạn sau 7 ngày
  // nên không thể lưu vào cơ sở dữ liệu, và chữ ký thay đổi cũng làm mất cache).
  const isPublicBase =
    rawPublicUrl && (rawPublicUrl.includes(".r2.dev") || !rawPublicUrl.includes(".r2.cloudflarestorage.com"));
  const fileUrl = isPublicBase ? `${rawPublicUrl}/${uniqueKey}` : `/api/upload/r2/${uniqueKey}`;

  return { url: fileUrl, key: uniqueKey };
}

/**
 * Lấy luồng dữ liệu tệp từ R2 (dùng cho streaming proxy)
 */
export async function getR2ObjectStream(key: string, range?: string) {
  if (!r2Client) throw new Error("R2 chưa được cấu hình.");
  // Range: cho phép tua video/audio và chỉ tải đoạn cần thiết
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    Range: range,
  });
  return await r2Client.send(command);
}
