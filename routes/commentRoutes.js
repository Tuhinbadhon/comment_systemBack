const express = require("express");
const { body, query } = require("express-validator");
const router = express.Router();
const {
  getComments,
  getComment,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
  dislikeComment,
  replyToComment,
} = require("../controllers/commentController");
const { protect, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");

// Validation rules
const createCommentValidation = [
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment must be between 1 and 1000 characters"),
  body("parentComment")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent comment ID"),
];

const updateCommentValidation = [
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment must be between 1 and 1000 characters"),
];

const replyValidation = [
  body("content")
    .trim()
    .notEmpty()
    .withMessage("Reply content is required")
    .isLength({ min: 1, max: 1000 })
    .withMessage("Reply must be between 1 and 1000 characters"),
];

const getCommentsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("sortBy")
    .optional()
    .isIn([
      "newest",
      "oldest",
      "mostLiked",
      "mostliked",
      "most-liked",
      "mostDisliked",
      "mostdisliked",
      "most-disliked",
    ])
    .withMessage("Invalid sort option"),
  query("filter")
    .optional()
    .isIn(["liked", "disliked"])
    .withMessage("Invalid filter option"),
  query("parentId")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent comment ID"),
];

router.get("/", getCommentsValidation, validate, optionalAuth, getComments);
router.get("/:id", optionalAuth, getComment);
router.post("/", createCommentValidation, validate, protect, createComment);
router.put("/:id", updateCommentValidation, validate, protect, updateComment);
router.delete("/:id", protect, deleteComment);
router.post("/:id/like", protect, likeComment);
router.post("/:id/dislike", protect, dislikeComment);
router.post("/:id/reply", replyValidation, validate, protect, replyToComment);

module.exports = router;
