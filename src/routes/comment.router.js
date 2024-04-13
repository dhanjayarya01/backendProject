    import { Router } from "express";
    import {
        getVideoComments,
        addComment,
        updateComment,
        deleteComment,
    } from "../controllers/comment.controller.js";
    import { verifyJWT } from "../middlewares/auth.middleware.js";
    import { upload } from "../middlewares/multer.middleware.js";

    const router = Router();

    router.use(verifyJWT, upload.none()); 

    router.get("/c/:videoId", getVideoComments);

    router.post("/c/:videoId", addComment);

    router.patch("/c/:commentId", updateComment);


    router.delete("/c/:commentId", deleteComment);

    export default router;
