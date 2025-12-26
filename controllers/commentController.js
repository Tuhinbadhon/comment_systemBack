const Comment = require("../models/Comment");
const pusher = require("../config/pusher");
const commentService = require("../services/commentService");

// @desc    Get all comments with pagination and sorting
// @route   GET /api/comments
// @access  Public
exports.getComments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortBy = req.query.sortBy || "newest"; // newest, mostLiked, mostDisliked
    const parentId = req.query.parentId || null;
    const filter = req.query.filter || "";

    // Delegate to service
    const { comments, total } = await commentService.getComments({
      page,
      limit,
      sortBy,
      parentId,
      filter,
    });

    // Add user interaction status if authenticated
    if (req.user) {
      comments.forEach((comment) => {
        comment.isLikedByUser = comment.likes.some(
          (id) => id.toString() === req.user.id.toString()
        );
        comment.isDislikedByUser = comment.dislikes.some(
          (id) => id.toString() === req.user.id.toString()
        );
        comment.isAuthor =
          comment.author._id.toString() === req.user.id.toString();
      });
    }

    res.status(200).json({
      success: true,
      count: comments.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: comments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single comment by ID
// @route   GET /api/comments/:id
// @access  Public
exports.getComment = async (req, res, next) => {
  try {
    const comment = await commentService.getCommentById(req.params.id);

    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const commentObj = comment.toObject();
    if (req.user) {
      commentObj.isLikedByUser = comment.likes.some(
        (id) => id.toString() === req.user.id.toString()
      );
      commentObj.isDislikedByUser = comment.dislikes.some(
        (id) => id.toString() === req.user.id.toString()
      );
      commentObj.isAuthor =
        comment.author._id.toString() === req.user.id.toString();
    }

    res.status(200).json({ success: true, data: commentObj });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new comment
// @route   POST /api/comments
// @access  Private
exports.createComment = async (req, res, next) => {
  try {
    const { content, parentComment } = req.body;
    const comment = await commentService.createComment({
      content,
      parentComment,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error) {
    if (error.message === "Parent comment not found")
      return res.status(404).json({ success: false, message: error.message });
    next(error);
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const comment = await commentService.updateComment({
      id: req.params.id,
      content,
      userId: req.user.id,
    });
    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: comment,
    });
  } catch (error) {
    if (error.message === "Comment not found")
      return res.status(404).json({ success: false, message: error.message });
    if (error.message === "Not authorized")
      return res.status(403).json({ success: false, message: error.message });
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    await commentService.deleteComment({
      id: req.params.id,
      userId: req.user.id,
    });
    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: {},
    });
  } catch (error) {
    if (error.message === "Comment not found")
      return res.status(404).json({ success: false, message: error.message });
    if (error.message === "Not authorized")
      return res.status(403).json({ success: false, message: error.message });
    next(error);
  }
};

// @desc    Like a comment
// @route   POST /api/comments/:id/like
// @access  Private
exports.likeComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const userId = req.user.id;

    // Check if already liked
    const alreadyLiked = comment.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      // Remove like
      comment.likes = comment.likes.filter((id) => id.toString() !== userId);
    } else {
      // Remove dislike if exists
      comment.dislikes = comment.dislikes.filter(
        (id) => id.toString() !== userId
      );

      // Add like
      comment.likes.push(userId);
    }

    await comment.save();
    await comment.populate("author", "name");

    // 🔔 Pusher event (safe)
    try {
      const pusherData = {
        commentId: comment._id.toString(),
        likeCount: comment.likes.length,
        dislikeCount: comment.dislikes.length,
      };

      await pusher.trigger("comments", "comment:liked", pusherData);
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    return res.status(200).json({
      success: true,
      message: alreadyLiked ? "Like removed" : "Comment liked",
      data: {
        comment,
        likeCount: comment.likes.length,
        dislikeCount: comment.dislikes.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Dislike a comment
// @route   POST /api/comments/:id/dislike
// @access  Private
exports.dislikeComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const userId = req.user.id;

    // Check if user already disliked
    const alreadyDisliked = comment.dislikes.includes(userId);

    if (alreadyDisliked) {
      // Remove dislike
      comment.dislikes = comment.dislikes.filter(
        (id) => id.toString() !== userId
      );
    } else {
      // Remove like if exists
      comment.likes = comment.likes.filter((id) => id.toString() !== userId);
      // Add dislike
      comment.dislikes.push(userId);
    }

    await comment.save();
    await comment.populate("author", "name email");

    // Trigger Pusher event for real-time update
    try {
      const pusherData = {
        commentId: comment._id.toString(),
        likeCount: comment.likes.length,
        dislikeCount: comment.dislikes.length,
      };
      // console.log("Triggering Pusher event comment:disliked", pusherData);
      await pusher.trigger("comments", "comment:disliked", pusherData);
      // console.log("Pusher event sent successfully");
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    res.status(200).json({
      success: true,
      message: alreadyDisliked ? "Dislike removed" : "Comment disliked",
      data: {
        comment,
        likeCount: comment.likes.length,
        dislikeCount: comment.dislikes.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to a comment
// @route   POST /api/comments/:id/reply
// @access  Private
exports.replyToComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const parentCommentId = req.params.id;

    // Verify parent comment exists
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Parent comment not found",
      });
    }

    // Create reply
    const reply = await Comment.create({
      content,
      author: req.user.id,
      parentComment: parentCommentId,
    });

    // Add to parent's replies array
    await Comment.findByIdAndUpdate(parentCommentId, {
      $push: { replies: reply._id },
    });

    await reply.populate("author", "name email");

    // Trigger Pusher event for real-time update
    try {
      await pusher.trigger("comments", "comment:reply", {
        reply: reply.toObject(),
        parentCommentId,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    res.status(201).json({
      success: true,
      message: "Reply posted successfully",
      data: reply,
    });
  } catch (error) {
    next(error);
  }
};

// Override: delegate like/dislike/reply to service (keeps controllers thin)
exports.likeComment = async (req, res, next) => {
  try {
    const { comment, likeCount, dislikeCount } =
      await commentService.likeComment({
        id: req.params.id,
        userId: req.user.id,
      });
    return res.status(200).json({
      success: true,
      message: "Operation successful",
      data: { comment, likeCount, dislikeCount },
    });
  } catch (error) {
    if (error.message === "Comment not found")
      return res.status(404).json({ success: false, message: error.message });
    next(error);
  }
};

exports.dislikeComment = async (req, res, next) => {
  try {
    const { comment, likeCount, dislikeCount } =
      await commentService.dislikeComment({
        id: req.params.id,
        userId: req.user.id,
      });
    return res.status(200).json({
      success: true,
      message: "Operation successful",
      data: { comment, likeCount, dislikeCount },
    });
  } catch (error) {
    if (error.message === "Comment not found")
      return res.status(404).json({ success: false, message: error.message });
    next(error);
  }
};

exports.replyToComment = async (req, res, next) => {
  try {
    const { content } = req.body;
    const parentCommentId = req.params.id;
    const reply = await commentService.replyToComment({
      parentCommentId,
      content,
      userId: req.user.id,
    });
    return res.status(201).json({
      success: true,
      message: "Reply posted successfully",
      data: reply,
    });
  } catch (error) {
    if (error.message === "Parent comment not found")
      return res.status(404).json({ success: false, message: error.message });
    next(error);
  }
};
