import {asyncHandler} from"../utils/asynHandler.js"
import {ApiError}from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadoncloudinary} from  "../utils/Cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt, { verify } from "jsonwebtoken"


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
  throw new ApiError(400," user side Avatar file is required ")
}

const avatar=await uploadoncloudinary(avatarLocalpath)
const coverImage=await uploadoncloudinary(coverImageLocalpath)

console.log("avatar console",avatar)
if(!avatar){
  throw new ApiError(400," Avatar file is required ")
  
}
const user= await User.create({
  fullName,avatar,
  coverImage:coverImage || "",
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
      $set:{refreshToken:undefined}
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
  const incomingRefreshToken=req.cookie.refreshToken || req.body.refreshToken

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
  
   const {accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
  
  return res
  .status(200)
  .cookie("accessToken",accessToken,option)
  .cookie("refreshToken",newrefreshToken,option)
  .json(
    new ApiResponse(
      200,
      {accessToken,refreshToken:newrefreshToken},
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
  .json(new ApiResponse(200,"Current User Fetched Successfully"))

})

const updateAccountDetails= asyncHandler(async(req,res)=>{
  const {fullName,email}=req.body

  if(!fullName || !email){
    throw new ApiError(400,"All fields are required ")
  }

   const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullName:fullName,
        email:email
      }
    },
    {new:true}
   ).select("-password")

   return res.status(200)
   .json(new ApiResponse(200,"Account details updated successfully"))

})


const updateUserAvatar=asyncHandler(async(req,res)=>{
        const avatarLocalpath=req.file?.path
        if(!avatarLocalpath){
          throw new ApiError(400,"Avatar file is missing")
        }

       const avatar=await uploadoncloudinary(avatarLocalpath)

       if(!avatar.url){
        throw new ApiError(500,"Error while uploading on avatar")
       }
         await User.findByIdAndDelete(req.user._id,{
          user.avatar
         })
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
        throw new ApiError(500,"Error while uploading on avatar")
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



const getUserChannelProfile=asyncHandler(async(req,res)=>{

      const {username}=req.params

      if(!username?.trim()){
        throw new ApiError(400,"username is missing")
      }

     const channel= await User.aggregate([
        {
          $match:{
            username:username?.toLowerCase()
          }
        },
        {
          $lookup:{
            from:"subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
          }
        },
        {
          $lookup:{
            from:"subcriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subcribedTo"
          }
        },{
          $addFields:{
            subscribersCount:{
              $size:"$subscribers"
            },
            channelsSubscribedCount:{
              $size:"subscribedTO"
            }
          }
        }
      ])
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
  updateUserCoverImage
}