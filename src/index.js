
import dotenv from "dotenv"
import connectDB from "./db/Dbconnect.js";
import app from'./app.js'

dotenv.config({
    path:'./.env'
})
const port=process.env.PORT || 4000;
connectDB()
.then(()=>{
    
    app.listen(port,()=>{
        console.log("server is running at port ",port)
    })
    app.on("error",(error)=>{
        console.log("error",error)
    })
})
.catch((error)=>{
    console.log("MONGODB connection failed !! ",error)
})