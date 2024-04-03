import { v2 as cloudinary } from "cloudinary";

const deleteFromCloudinary = async (deleteUrl) => {
    try {
        const url =deleteUrl
        const lastPart = url.split('/').pop();
        const publicId = lastPart.split('.')[0];

        const result = await cloudinary.uploader.destroy(publicId, {
            invalidate: true, 
            resource_type: 'image' 
        });
        console.log("Successfully deleted from Cloudinary:", result.result);
    } catch (error) {
        console.error("Error deleting from Cloudinary:", error);
        throw error;
    }
};

export default deleteFromCloudinary;
