import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID || "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const bucketName = process.env.R2_BUCKET_NAME || "lms-media";
const rawPublicUrl = (process.env.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");

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
    })
  );

  let fileUrl = "";
  // Nếu có custom domain hoặc r2.dev public subdomain
  if (rawPublicUrl && (rawPublicUrl.includes(".r2.dev") || !rawPublicUrl.includes(".r2.cloudflarestorage.com"))) {
    fileUrl = `${rawPublicUrl}/${uniqueKey}`;
  } else {
    // Tạo presigned GET URL (hiệu lực 7 ngày = 604800 giây)
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: uniqueKey,
      });
      fileUrl = await getSignedUrl(r2Client, getCommand, { expiresIn: 604800 });
    } catch {
      fileUrl = `/api/upload/r2/${uniqueKey}`;
    }
  }

  return { url: fileUrl, key: uniqueKey };
}

/**
 * Lấy luồng dữ liệu tệp từ R2 (dùng cho streaming proxy)
 */
export async function getR2ObjectStream(key: string) {
  if (!r2Client) throw new Error("R2 chưa được cấu hình.");
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return await r2Client.send(command);
}
