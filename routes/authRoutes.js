const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");

// Validation rules
const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Name must be between 3 and 50 characters"),
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("phone")
    .optional()
    .trim()
    .matches(/^[0-9]{10,15}$/)
    .withMessage("Please provide a valid phone number"),
];

const loginValidation = [
  body("password").notEmpty().withMessage("Password is required"),
];

router.post("/register", registerValidation, validate, register);
router.post("/login", loginValidation, validate, login);
router.get("/me", protect, getMe);

module.exports = router;
