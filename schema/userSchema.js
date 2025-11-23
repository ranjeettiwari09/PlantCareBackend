const mongoose=require("mongoose")

const userSchema=new mongoose.Schema({
    name:String,
    email:String,
    age:Number,
    gender:String,
    password:String,
    type:String,
    profileImageUrl:String,
    following:[{
        type:String, // Array of user emails that this user follows
        default:[]
    }],
    followers:[{
        type:String, // Array of user emails that follow this user
        default:[]
    }]
})

module.exports=mongoose.model("user",userSchema)