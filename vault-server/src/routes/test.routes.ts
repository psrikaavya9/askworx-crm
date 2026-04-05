/**
 * test.routes.ts — TEMPORARY debug route for employee-doc visibility testing.
 * Remove this file (and its registration in routes/index.ts) after verification.
 *
 * GET /api/v1/test/employee-docs
 *   Returns the current JWT user + the documents they are authorized to see.
 *   Requires a valid Bearer token in Authorization header.
 */

import { Router, Response } from "express";
import { authenticate }    from "../middleware/auth.middleware";
import { listDocuments }   from "../services/document.service";
import { AuthRequest }     from "../types";

const router = Router();

router.get(
  "/employee-docs",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;

      console.log(`[test-route] GET /test/employee-docs  user=${user.sub}  role=${user.role}`);

      const { rows: documents } = await listDocuments({ user, limit: 50 });

      res.json({
        user: {
          id:    user.sub,
          email: user.email,
          role:  user.role,
        },
        documentCount: documents.length,
        documents: documents.map((d) => ({
          id:         d.id,
          title:      d.title,
          category:   d.category,
          employeeId: d.employeeId ?? null,
          status:     d.status,
        })),
      });
    } catch (err) {
      console.error("[test-route] Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
