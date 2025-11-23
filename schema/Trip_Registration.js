const mongoose=require("mongoose")

const Trip_Registration=new mongoose.Schema({
    userName:String,
    dob:Date,
    fatherName:String,
    motherName:String,
    travelDate:Date,
    aadhaarId:String,
    permanentAddress:String,
    email:String,
    status:String
})
module.exports=mongoose.model("Trip_Registration",Trip_Registration)