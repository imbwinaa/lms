import { Readable } from "stream";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// R2 giả lập: không gọi Cloudflare thật
const getR2ObjectStream = vi.fn();
vi.mock("../src/lib/r2", () => ({
  IMMUTABLE_CACHE: "public, max-age=31536000, immutable",
  isR2Configured: true,
  uploadFileToR2: vi.fn(),
  getR2ObjectStream: (...args: unknown[]) => getR2ObjectStream(...args),
}));

const { default: app } = await import("../src/app");

const DATA = Buffer.from("0123456789");

describe("R2 proxy", () => {
  it("streams the whole file with long-lived cache headers", async () => {
    getR2ObjectStream.mockResolvedValueOnce({
      Body: Readable.from([DATA]),
      ContentType: "video/mp4",
      ContentLength: DATA.length,
    });
    const res = await request(app).get("/api/upload/r2/123-video.mp4");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(getR2ObjectStream).toHaveBeenLastCalledWith("123-video.mp4", undefined);
  });

  it("forwards byte ranges so videos can seek", async () => {
    getR2ObjectStream.mockResolvedValueOnce({
      Body: Readable.from([DATA.subarray(2, 6)]),
      ContentType: "video/mp4",
      ContentLength: 4,
      ContentRange: "bytes 2-5/10",
    });
    const res = await request(app).get("/api/upload/r2/123-video.mp4").set("Range", "bytes=2-5");
    expect(res.status).toBe(206);
    expect(res.headers["content-range"]).toBe("bytes 2-5/10");
    expect(getR2ObjectStream).toHaveBeenLastCalledWith("123-video.mp4", "bytes=2-5");
  });

  it("ignores malformed ranges and reports missing files", async () => {
    getR2ObjectStream.mockRejectedValueOnce(Object.assign(new Error("NoSuchKey"), { $metadata: { httpStatusCode: 404 } }));
    const res = await request(app).get("/api/upload/r2/missing").set("Range", "bytes=0-1,5-6");
    expect(res.status).toBe(404);
    expect(getR2ObjectStream).toHaveBeenLastCalledWith("missing", undefined);
  });
});
