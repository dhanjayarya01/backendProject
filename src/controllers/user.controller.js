import {asyncHandler} from"../utils/asynHandler.js"
import {ApiError}from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadoncloudinary} from  "../utils/Cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose, { Mongoose } from "mongoose"
import Deletefromcloudinary from "../utils/Deletefromcloudinary.js"
const generateAccessAndRefreshTokens = async(userId)=>{
  try{
      const user=await User.findById(userId)
     const accessToken=  user.generateAccessToken()
     const refreshToken=  user.generateRefreshToken()
     user.refreshToken=refreshToken
    await user.save({validateBeforeSave:false})
    return {accessToken,refreshToken}
      
  } catch(error){
    throw new ApiError(500,"something went wrog  while generation Access and refresh Token")
  }
}

const registerUser=asyncHandler(async (req,res)=>{
  //get user details from frontend 
  // validation 
  // check if user already exists 
  // check the required image 
  // upload them to cloudinary , avatar
  // create user object -- create entry in db
  // remove password and refresh token field from response
 // check for user creation 
 // return res

 const {fullName,email,username,password}=req.body
 console.log("useremail",email)
 if([fullName,email,username,password].some((field)=>field?.trim() === ""))
 {
   throw new ApiError(400,"All fields are required")
 }
 
const exitedUser= await User.findOne({
  $or:[{ username },{ email }]
 })

 if(exitedUser){
  throw new ApiError(409,"user exit with same username or email")
 }



const avatarLocalpath= req.files?.avatar[0]?.path;
let coverImageLocalpath;
if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalpath = req.files.coverImage[0].path
}

if(!avatarLocalpath){
  throw new ApiError(400,"  AvatarLocalfilepath is required ")
}

const avatar=await uploadoncloudinary(avatarLocalpath)
const coverImage=await uploadoncloudinary(coverImageLocalpath)

if(!avatar.url){
  throw new ApiError(400," Avatar file is required ")
  
}

const user= await User.create({
  fullName,avatar:avatar.url,
  coverImage:coverImage.url || "",
  email,password,
  username:username.toLowerCase()
})

  
 const createduser=await User.findById(user._id).select(
  "-password -refreshToken"
 )

 if(!createduser){
  throw new ApiError(500,"something went wrong while registing the user")
 }

   return res.status(201).json(
    new ApiResponse(200, createduser, "user registered successfully")
   )
})

const loginUser=asyncHandler(async(req,res)=>{
  //req.body ->data
  // validation (username,email)
  //find the user 
  //check password 
  //access and refresh token
  // send cookie

  const {email,username,password}=req.body
  if(!(username|| email)){
    throw new ApiError(400,"username or email and password is required")
  }


  const user =await User.findOne({
    $or:[{username},{email}]
  })


  if(!user){
    throw new ApiError(404,"user not exist")
  }
  const isPasswordValid = await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }


const {accessToken,refreshToken}= await generateAccessAndRefreshTokens(user._id)

const loggedInuser= await User.findById(user._id).select("-password -refreshToken")

const options={
  httpOnly:true,
  secure:true
}


return res
.status(200)
.cookie("accessToken", accessToken, options)



.cookie("refreshToken", refreshToken, options)
.json(
    new ApiResponse(
        200, 
        {
            user: loggedInuser, accessToken, refreshToken
        },
        "User logged In Successfully"
    )
)

})


const logoutUser= asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset:{refreshToken:1}
    },
    {
      new:true
    }
  )

  const options={
    httpOnly:true,
    secure:true
  }

  return res
  .status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse (200,{},"User Logged Out"))
})


const refreshAccessToken = asyncHandler(async(req,res)=>{
  console.log("hihihih")
  console.log("hi",req.cookies.refreshToken)
  const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401,"unauthorized request ")
  
  }
try {
  
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
    const user=await User.findById(decodedToken._id)
    
    if(!user){
      throw new ApiError(401,"Invalid Refresh Token")
    }
  
    if(incomingRefreshToken !==user?.refreshToken){
      throw new ApiError(401,"Refresh token is expired or used ")
    }
  
    const option={
      httpOnly:true,
      secure:true
    }
  
   const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)
  return res
  .status(200)
  .cookie("accessToken",accessToken,option)
  .cookie("refreshToken",refreshToken,option)
  .json(
    new ApiResponse(
      200,
      {accessToken,refreshToken:refreshToken},
      "Access token Refresh"
    )
  )
} catch (error) {
  throw new ApiError(401,error?.message || "Invalid Refresh Token")
}

})


const changeCurrentPassword = asyncHandler(async(req,res)=>{
  const {oldPassword, newPassword}= req.body

  const user= await User.findById(req.user?._id)
 const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)
 
 if(!isPasswordCorrect){
  throw new ApiError(401,"Invalid Password")

 }

 user.password=newPassword
await user.save({validateBeforeSave:false})

return res.status(200)
.json(new ApiResponse(200,{},"password changed successfully "))
})

const getCurrentUser=asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(new ApiResponse(200,req.user,"Current User Fetched Successfully"))

})


const updateAccountDetails= asyncHandler(async(req,res)=>{
  const {fullName,email,username}=req.body

  // if(fullName || !email){
  //   throw new ApiError(400,"All fields are required ")
  // }

   const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        username,
        fullName:fullName,
        email:email
      }
    },
    {new:true}
   ).select("-password")

   return res.status(200)
   .json(new ApiResponse(200,user,"Account details updated successfully"))

})


const updateUserAvatar=asyncHandler(async(req,res)=>{
        const avatarLocalpath=req.file?.path
        if(!avatarLocalpath){
          throw new ApiError(400,"Avatar file is missing")
        }
       const avatar=await uploadoncloudinary(avatarLocalpath)

       if(!avatar.url){
        throw new ApiError(500,"Error while uploading ")
       }
        
  const currentUser = await User.findById(req.user?._id);
  const prevAvatarPath = currentUser.avatar;
  if (prevAvatarPath) {
    await Deletefromcloudinary(prevAvatarPath);
}
     const user=  await User.findByIdAndUpdate(
        req.user?._id,
        {
          $set:{
            avatar:avatar.url
          }
        },
        {
          new:true
        }

       ).select("-password")
     

       return res.status(200)
       .json(new ApiResponse(200,user,"Avatar updated successfully"))
})


const updateUserCoverImage=asyncHandler(async(req,res)=>{
        const coverImageLocalpath=req.file?.path
        if(!coverImageLocalpath){
          throw new ApiError(400,"Avatar file is missing")
        }

       const coverImage=await uploadoncloudinary(coverImageLocalpath)

       if(!coverImage.url){
        throw new ApiError(500,"Error while uploading ")
       }

       const currentUser = await User.findById(req.user?._id);
       const prevCoverImage = currentUser.coverImage;
       if (prevCoverImage) {
         await Deletefromcloudinary(prevCoverImage);
        }

     const user=  await User.findByIdAndUpdate(
        req.user?._id,
        {
          $set:{
            coverImage:coverImage.url,
          }
        },
        {
          new:true
        }

       ).select("-password")

       return res.status(200)
       .json(new ApiResponse(200,user,"coverImage updated successfully"))
}) 


const getUserChannelProfile = asyncHandler(async(req, res) => {
  const {username} = req.params

  if (!username?.trim()) {
      throw new ApiError(400, "username is missing")
  }

  const channel = await User.aggregate([
      {
          $match: {
              username: username?.toLowerCase()
          }
      },
      {
          $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers"
          }
      },
      {
          $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "subscriber",
              as: "subscribedTo"
          }
      },
      {
          $addFields: {
              subscribersCount: {
                  $size: "$subscribers"
              },
              channelsSubscribedToCount: {
                  $size: "$subscribedTo"
              },
              isSubscribed: {
                  $cond: {
                      if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                      then: true,
                      else: false
                  }
              }
          }
      },
      {
          $project: {
              fullName: 1,
              username: 1,
              subscribersCount: 1,
              channelsSubscribedToCount: 1,
              isSubscribed: 1,
              avatar: 1,
              coverImage: 1,
              email: 1

          }
      }
  ])

  if (!channel?.length) {
      throw new ApiError(404, "channel does not exists")
  }

  return res
  .status(200)
  .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
  )
})

// error
const getWatchHistory = asyncHandler(async(req, res) => {
  const user = await User.aggregate([
      {
          $match: {
              _id:new mongoose.Types.ObjectId(req.user?._id)
          }
      },
      {
        $lookup:{
          from:"videos",
          localField:"watchHistory",
          foreignField:"_id",
          as:"watchHistory",
          pipeline:[
            {
              $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner",
                pipeline:[
                  {
                    $project:{
                      fullName:1,
                      avatar:1,
                      username:1
                    }
                  }
                ]
              }
            },
            {
              $addFields:{
                owner:{
                   $first:"$owner"
                }
              }
            }
          ]
        }
      }
  ])

  return res
  .status(200)
  .json(new ApiResponse(200, user[0].watchHestory,"watchHistory fetched successfully "))
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountDetails,
  getCurrentUser,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
}