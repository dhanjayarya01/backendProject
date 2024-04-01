import { v2 as cloudinary } from "cloudinary";


const Deletefromcloudinary = async(deleteurl)=> {
   await cloudinary.uploader.destroy(deleteurl)
}
export default Deletefromcloudinary