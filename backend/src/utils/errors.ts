export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export const notFound = () =>
  new ApiError(404, "NOT_FOUND", "Resource not found");
