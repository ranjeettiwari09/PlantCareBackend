const dotenv = require("dotenv")
dotenv.config()

const express = require("express")
const app = express();
const http = require("http");
const mongoose = require("mongoose");
const { router } = require("./Routes/userAuth")
const post = require("./Routes/post")
const mailerRouter = require("./Routes/nodemailer")
const chatRouter = require("./Routes/chat")
const notificationRouter = require("./Routes/notification")
const aiChatRouter = require("./Routes/aiChat")
const followRouter = require("./Routes/follow")
const plantRouter = require("./Routes/plant")
const cors = require("cors")
const cloudinaryConfig = require("./MiddleWare/cloudnary")

app.use(cors())
app.use(express.json())
cloudinaryConfig();
app.use("/auth", router)
app.use("/posts", post)
app.use("/mailer", mailerRouter)
app.use("/chat", chatRouter)
app.use("/notifications", notificationRouter)
app.use("/ai", aiChatRouter)
app.use("/follow", followRouter)
app.use("/plants", plantRouter)

// Initialize HTTP server and Socket.IO for signaling
const server = http.createServer(app)
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

const jwt = require("jsonwebtoken");
const User = require("./schema/userSchema");

// Export io immediately so routes can use it
module.exports.io = io;
module.exports.server = server;

io.on("connection", (socket) => {
  socket.on("register", async ({ token }) => {
    try {
      const decoded = jwt.verify(token, "Userdata");
      const user = await User.findById(decoded.id);
      if (!user) {
        return socket.disconnect(true);
      }
      socket.data.email = user.email;
      socket.join(user.email); // personal room
    } catch (err) {
      socket.disconnect(true);
    }
  });
});

server.listen(process.env.PORT, () => {
  mongoose.connect(process.env.MONGODB_URI)
  console.log("server is listening on port 5000")
  console.log("database connected")
})