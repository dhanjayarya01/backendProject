import { Router } from "express";
import {
    
    deleteComment,
    updateComment,
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.use(verifyJWT, upload.none()); 
router.route("/c/:commentId").delete(deleteComment).patch(updateComment);

export default router;