import { v2 as cloudinary } from "cloudinary";
import fs from'fs'

cloudinary.config({
    cloud_name:process.env.CLOUDINARY_CLOUDNAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET
})

const uploadoncloudinary =async (localFilePath)=>{
    try{
         if(!localFilePath) return null
         //file Upload
         const responce= await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
          })
          console.log("file is uploaded on cloudinary",responce.url);
          fs.unlinkSync(localFilePath)
          return responce.url;
          
    } catch(error){
       fs.unlinkSync(localFilePath) 
       return null;
    }
}

export {uploadoncloudinary}