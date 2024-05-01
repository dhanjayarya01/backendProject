import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";



const app= express()


app.use(express.static('dist'))
app.use(cors({
    origin: '*',
    credentials:true,
}))


app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())


//routes import 
import userRouter from "./routes/user.router.js";
import videoRouter from "./routes/video.router.js"
import commentRouter from "./routes/comment.router.js";
import likeRouter from "./routes/like.router.js"
import  SubscriptionRouter from  "./routes/subscriber.router.js";
// routes declaration

app.use("/api/v1/users",userRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comment", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/subcription", SubscriptionRouter)

export default app