/**
 * Các trang đang phát triển (WIP): ẩn khỏi điều hướng và hiển thị trang "Sắp ra mắt".
 * Xóa đường dẫn khỏi danh sách này để bật lại tính năng.
 */
export const WIP_PATHS: ReadonlySet<string> = new Set(['/certificates', '/leaderboard', '/gamification']);

export const isWipPath = (path: string) => WIP_PATHS.has(path);
