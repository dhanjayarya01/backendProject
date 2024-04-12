import { ApiError } from "../utils/ApiError.js";
import { uploadoncloudinary } from "../utils/Cloudinary.js";
import { asyncHandler } from "../utils/asynHandler.js";
import { Video } from "../models/video.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import mongoose ,{isValidObjectId}from "mongoose";
import deleteFromCloudinary from "../utils/Deletefromcloudinary.js";

const getAllVideos=asyncHandler(async(req,res)=>{
    
const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

const pipeline=[]

if(query){
    pipeline.push({
        $search:{
            index:"search-index",
            text:{
                query:query,
                path:["title","description"]
            }
        }
    });
}

if(userId){
    if(!isValidObjectId(userId)){
      throw new ApiError(400,"Invalid userId")
    }

    pipeline.push({
        $match:{
            owner:new mongoose.Types.ObjectId(userId)
        }
    })
}

pipeline.push({ $match: { isPublished: true } });

if (sortBy && sortType) {
    pipeline.push({
        $sort: {
            [sortBy]: sortType === "asc" ? 1 : -1
        }
    });
} else {
    pipeline.push({ $sort: { createdAt: -1 } });
}


pipeline.push(
    {
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "ownerDetails",
            pipeline: [
                {
                    $project: {
                        username: 1,
                        "avatar": 1
                    }
                }
            ]
        }
    },
    {
        $unwind: "$ownerDetails"
    }
)

const videoAggregate = Video.aggregate(pipeline);

const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
};

const video = await Video.aggregatePaginate(videoAggregate, options);

return res
    .status(200)
    .json(new ApiResponse(200, video, "Videos fetched successfully"));
})
const publishAVideo = asyncHandler(async (req, res) => {
    const {title,description}=req.body

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;

    if(!videoFileLocalPath){
        throw new ApiError(400,"videofile Localpath required")
    }
    if(!thumbnailLocalPath){
        throw new ApiError(400,"Thubnail Localpath required")
    }

    const videoFile= await uploadoncloudinary(videoFileLocalPath)
    const thumbnail= await uploadoncloudinary(thumbnailLocalPath)

    if(!videoFile.url){
        throw new ApiError(500,"ERROR WHILE UPLOADING VIDEO")
    }
    if(!thumbnail.url){
        throw new ApiError(500,"ERROR WHILE UPLOADING THUMBNAIL")
    }
  

    const video = await Video.create({
        title,
        description,
        thumbnail:thumbnail.url,
        videoFile:videoFile.url,
        duration:videoFile.duration,
        owner:req.user?._id,
        isPublished:true    //false
    })

    return res
    .status(200)
    .json(new ApiResponse(200,video,"video uploaded successfully "))
   
})

const getVideoById =asyncHandler(async(req,res)=>{
    const {videoId}=req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

   const video= await Video.aggregate([
    {
        $match:{
            _id:new mongoose.Types.ObjectId(videoId)
        }
    },
    {
        $lookup:{
            from:"likes",
            localField:"_id",
            foreignField:"video",
            as:"likes"
        }
    },
    {    //owner
        $lookup:{
            from:"users",
            localField:"owner",
            foreignField:"_id",
            as:"owner",
            pipeline:[
            {
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"channel",
                    as:"subscribers"
                }
            },
            {
               $addFields:{
                subscribercount:{
                    $size:"$subscribers"
                },
                isSubscribed:{
                    $cond:{
                        if:{
                            $in:[req.user._id,"$subscribers.subscriber"]
                        },
                        then:true,
                        else:false,
                    }
                }
               }
            },
            {   //projection of owner of the chennel
                $project:{
                    username:1,
                   "avatar.url":1,
                    subscribercount:1,
                    isSubscribed:1

                }
            }
            ]
        }
    },
    {
        $addFields:{
            likecount:{
                $size:"$likes"
            },
            owner:{
                $first:"$owner"
            },
            isLiked:{
                $cond:{
                    if:{$in:[req.user?._id,"$likes.likeBy"]},
                    then:true,
                    else:false
                }
            }

        }
    },
    {
        $project:{
            "videoFile.url": 1,
            title: 1,
            description: 1,
            views: 1,
            createdAt: 1,
            duration: 1,
            comments: 1,
            owner: 1,
            likesCount: 1,
            isLiked: 1
        }
    }
   ]);

   if (!video) {
    throw new ApiError(500, "failed to fetch video");
}


await Video.findByIdAndUpdate(videoId, {
    $inc: {
        views: 1
    }
});

await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: {
        watchHistory: videoId
    }
});

return res
.status(200)
.json(new ApiResponse(200,video,"video fetched successfully"))
   
})

const updateVideo =asyncHandler(async(req,res)=>{

    const { title, description } = req.body;
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    if (!(title && description)) {
        throw new ApiError(400, "title and description are required");
    }

    const video = await Video.findById(videoId)
    
    if(!video){
        throw new ApiError(404,"no video found ")
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't edit this video as you are not the owner"
        );
    }

    const oldThumbnail=video.thumbnail

    const thumbnailLocalPath=req.file?.path
    if(!thumbnailLocalPath){
        throw new ApiError(404,"All field require")
    }

    const thumbnail=await uploadoncloudinary(thumbnailLocalPath)
    
    deleteFromCloudinary(oldThumbnail)

    const updatedVideo= await Video.findByIdAndUpdate(videoId,
        {
            $set:{
             title,
             description,
             thumbnail:thumbnail.url
            }
        },
        {new:true}
        );


        return res
        .status(200)
        .json(200,updateVideo,"Updated the video successfully")
})


const deleteVideo=asyncHandler(async(req,res)=>{
    const{videoId} =req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid videoId")
    }

    const video= await Video.findById(videoId)

    if(!video){
        throw new ApiError(404,"video not found")
    }


    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't delete this video as you are not the owner"
        );
    }


    const videoDeleted = await Video.findByIdAndDelete(video?._id);

    if (!videoDeleted) {
        throw new ApiError(400, "Failed to delete the video please try again");
    }

    await deleteFromCloudinary(video.thumbnail)
    await deleteFromCloudinary(video.videoFile)

      await Like.deleteMany({
        video: videoId
    }) 

    await Comment.deleteMany({
        video: videoId,
    })


    return res
    .status(200)
    .json(new ApiResponse(200,"video is deleted"))
})


const togglePublishStatus = asyncHandler(async(req,res)=>{

    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video?.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(
            400,
            "You can't toogle publish status as you are not the owner"
        );
    }

    const toggledVideoPublish=Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                isPublished: !video?.isPublished
            }
        },
        {
            new:true
        }

    );

    if (!toggledVideoPublish) {
        throw new ApiError(500, "Failed to toogle video publish status");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            { isPublished: toggledVideoPublish.isPublished },
            "Video publish toggled successfully"
        )
    );
});


export {
    publishAVideo,
    updateVideo,
    deleteVideo,
    getAllVideos,
    getVideoById,
    togglePublishStatus,
};