import mongoose from "mongoose";
import {DB_NAME} from "../constents.js"

const connectDB =async()=>{

    try{
        const connectionInstance =await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch(error){
        console.log("mongooDB connection error",error);
        process.exit(1)
    }
}

export default connectDB