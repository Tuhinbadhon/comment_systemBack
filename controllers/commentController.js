const Comment = require("../models/Comment");
const pusher = require("../config/pusher");

// @desc    Get all comments with pagination and sorting
// @route   GET /api/comments
// @access  Public
exports.getComments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sortBy = req.query.sortBy || "newest"; // newest, mostLiked, mostDisliked
    const parentId = req.query.parentId || null;

    console.log("Sort by:", sortBy); // Debug log

    const skip = (page - 1) * limit;

    // Build query and filter
    const filter = (req.query.filter || "").toLowerCase();
    console.log("Filter:", filter); // Debug log

    // Build match stage for aggregation
    const matchStage = {};
    // parentId may be null for top-level comments
    matchStage.parentComment = parentId;

    if (filter === "liked") {
      matchStage.$expr = { $gt: [{ $size: "$likes" }, 0] };
    } else if (filter === "disliked") {
      matchStage.$expr = { $gt: [{ $size: "$dislikes" }, 0] };
    }

    // Build sort
    let sort = {};
    const sortByLower = sortBy.toLowerCase();
    switch (sortByLower) {
      case "mostliked":
      case "most-liked":
        sort = { likeCount: -1, createdAt: -1 };
        console.log("Sorting by most liked");
        // If filter not explicitly provided, treat this sort as a filter (only show liked comments)
        if (!filter) {
          matchStage.$expr = { $gt: [{ $size: "$likes" }, 0] };
          console.log("Applying filter: liked (from sortBy)");
        }
        break;
      case "mostdisliked":
      case "most-disliked":
        sort = { dislikeCount: -1, createdAt: -1 };
        console.log("Sorting by most disliked");
        if (!filter) {
          matchStage.$expr = { $gt: [{ $size: "$dislikes" }, 0] };
          console.log("Applying filter: disliked (from sortBy)");
        }
        break;
      case "oldest":
        sort = { createdAt: 1 };
        console.log("Sorting by oldest");
        break;
      case "newest":
      default:
        sort = { createdAt: -1 };
        console.log("Sorting by newest");
        break;
    }

    console.log("Sort object:", sort); // Debug log

    // Get comments with aggregation for sorting/filtering by like/dislike count
    const comments = await Comment.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          dislikeCount: { $size: "$dislikes" },
          replyCount: { $size: "$replies" },
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
        },
      },
      { $unwind: "$author" },
      {
        $lookup: {
          from: "comments",
          localField: "replies",
          foreignField: "_id",
          as: "replies",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "replies.author",
          foreignField: "_id",
          as: "replyAuthors",
        },
      },
      {
        $addFields: {
          replies: {
            $map: {
              input: "$replies",
              as: "reply",
              in: {
                _id: "$$reply._id",
                content: "$$reply.content",
                author: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$replyAuthors",
                        as: "author",
                        cond: { $eq: ["$$author._id", "$$reply.author"] },
                      },
                    },
                    0,
                  ],
                },
                likes: "$$reply.likes",
                dislikes: "$$reply.dislikes",
                likeCount: { $size: "$$reply.likes" },
                dislikeCount: { $size: "$$reply.dislikes" },
                isEdited: "$$reply.isEdited",
                createdAt: "$$reply.createdAt",
                updatedAt: "$$reply.updatedAt",
              },
            },
          },
        },
      },
      {
        $project: {
          content: 1,
          author: {
            _id: 1,
            name: 1,
            email: 1,
          },
          parentComment: 1,
          likes: 1,
          dislikes: 1,
          replies: 1,
          likeCount: 1,
          dislikeCount: 1,
          replyCount: 1,
          isEdited: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    // Get total count (use the same matchStage as aggregation)
    const total = await Comment.countDocuments(matchStage);

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
    const comment = await Comment.findById(req.params.id)
      .populate("author", "name email")
      .populate({
        path: "replies",
        populate: {
          path: "author",
          select: "name email",
        },
      });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Add user interaction status if authenticated
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

    res.status(200).json({
      success: true,
      data: commentObj,
    });
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

    // If it's a reply, verify parent comment exists
    if (parentComment) {
      const parentExists = await Comment.findById(parentComment);
      if (!parentExists) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found",
        });
      }
    }

    const comment = await Comment.create({
      content,
      author: req.user.id,
      parentComment: parentComment || null,
    });

    // If it's a reply, add to parent's replies array
    if (parentComment) {
      await Comment.findByIdAndUpdate(parentComment, {
        $push: { replies: comment._id },
      });
    }

    await comment.populate("author", "name email");

    // Trigger Pusher event for real-time update
    try {
      await pusher.trigger("comments", "comment:created", {
        comment: comment.toObject(),
        parentComment,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    res.status(201).json({
      success: true,
      message: "Comment created successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Make sure user is comment owner
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this comment",
      });
    }

    const { content } = req.body;

    comment = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        content,
        isEdited: true,
        updatedAt: Date.now(),
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate("author", "name email");

    // Trigger Pusher event for real-time update
    try {
      await pusher.trigger("comments", "comment:updated", {
        comment: comment.toObject(),
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Make sure user is comment owner
    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this comment",
      });
    }

    // If comment has a parent, remove from parent's replies
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: comment._id },
      });
    }

    // Delete all replies to this comment
    if (comment.replies && comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
    }

    await comment.deleteOne();

    // Trigger Pusher event for real-time update
    try {
      await pusher.trigger("comments", "comment:deleted", {
        commentId: req.params.id,
      });
    } catch (pusherError) {
      console.error("Pusher error:", pusherError);
    }

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      data: {},
    });
  } catch (error) {
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
