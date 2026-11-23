export * from "./generated/api";
export * from "./generated/types";
// Orval đặt cùng tên cho schema Zod của tham số đường dẫn và kiểu TS của tham số query;
// ưu tiên schema Zod (dùng để kiểm tra dữ liệu ở route)
export { DeleteCourseSessionParams, ListCourseSessionsParams } from "./generated/api";
