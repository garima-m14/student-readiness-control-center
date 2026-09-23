import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, authenticated } from "../middleware/security.js";
import { loginSchema } from "../validation/schemas.js";
import { login, logout } from "./service.js";
export const authRouter = Router();
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "strict" as const,
  path: "/api",
  maxAge: 8 * 3600_000,
});
authRouter.post(
  "/login",
  rateLimit({
    windowMs: 900_000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) =>
      res
        .status(429)
        .json({
          code: "RATE_LIMITED",
          message: "Too many sign-in attempts. Try again later.",
          requestId: req.requestId,
          fields: {},
        }),
  }),
  asyncHandler(async (req, res) => {
    const result = await login(loginSchema.parse(req.body));
    res
      .cookie("session", result.token, cookieOptions())
      .json({ ...result.user, sessionId: result.sessionId });
  }),
);
authRouter.get(
  "/me",
  authenticated,
  asyncHandler(async (req, res) => res.json(req.identity)),
);
authRouter.post(
  "/logout",
  authenticated,
  asyncHandler(async (req, res) => {
    await logout(req.identity.sessionId);
    res
      .clearCookie("session", { ...cookieOptions(), maxAge: undefined })
      .json({ ok: true });
  }),
);
