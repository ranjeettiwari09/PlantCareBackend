const mongoose=require("mongoose")

const postschema=new mongoose.Schema({
    email:String,
    caption:String,
    image:String,
    date:Date,
    likeCount:Number,
    comment:[],
    likedBy:[String]
})

module.exports=mongoose.model("posts",postschema)