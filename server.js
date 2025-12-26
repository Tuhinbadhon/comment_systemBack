require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// Import routes
const authRoutes = require("./routes/authRoutes");
const commentRoutes = require("./routes/commentRoutes");

// Connect to database
connectDB();

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io with polling for Vercel compatibility
const io = socketIo(server, {
  cors: {
    origin:
      process.env.CLIENT_URL ||
      "http://localhost:3000" ||
      "https://comment-system-front.vercel.app/",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"], // Polling first for serverless
  allowEIO3: true,
});

// Make io accessible to routes
app.set("io", io);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  // Join a specific page/room for targeted updates
  socket.on("join-page", (pageId) => {
    socket.join(pageId);
    console.log(`Socket ${socket.id} joined page: ${pageId}`);
  });

  socket.on("leave-page", (pageId) => {
    socket.leave(pageId);
    console.log(`Socket ${socket.id} left page: ${pageId}`);
  });
});

// Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use("/api/", limiter);

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Comment System API is running",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      comments: "/api/comments",
    },
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/comments", commentRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler middleware (should be last)
app.use(errorHandler);

// Export both app and server for Vercel
module.exports = app;
module.exports.io = io;

// Start server for local development and Vercel
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  // Only start server if run directly (not imported)
  server.listen(PORT, () => {
    console.log(
      `Server running in ${
        process.env.NODE_ENV || "development"
      } mode on port ${PORT}`
    );
    console.log(`WebSocket server is ready`);
  });
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log(`Error: ${err.message}`);
});
