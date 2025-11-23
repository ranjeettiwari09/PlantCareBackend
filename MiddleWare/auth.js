const jwt = require("jsonwebtoken");
const User = require("../schema/userSchema");

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(authHeader);
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, "Userdata");
      req.user = await User.findById(decoded.id);
      next();
    } catch (error) {
      console.error(error);
      res.status(401).send("Unauthorized: Invalid token");
    }
  } else {
    console.log("No token provided"); 
    res.status(401).send("Unauthorized: No token provided");
  }
};

module.exports={
    authenticateUser:authenticateUser
}