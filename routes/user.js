const express = require("express");
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const cloudinary = require("cloudinary").v2;
const router = express.Router();
const User = require("../models/User");
const Offer = require("../models/Offer");

router.post("/user/signup", async (req, res) => {
  try {
    const { username, email, password, newsletter } = req.fields;

    const userSameMail = await User.findOne({ email: email });
    const userSameUsername = await User.findOne({
      "account.username": username,
    });

    if (username && email && password && newsletter) {
      if (!userSameMail) {
        if (!userSameUsername) {
          const salt = uid2(16);
          const hash = SHA256(salt + password).toString(encBase64);
          const token = uid2(64);
          const picture = req.files.picture.path;
          const avatar = await cloudinary.uploader.upload(picture, {
            folder: "api/user/avatar",
          });

          const newUser = await new User({
            email: email,
            account: {
              username: username,
              avatar: avatar,
            },
            newsletter: newsletter,
            token: token,
            hash: hash,
            salt: salt,
          });

          await newUser.save();
          res.status(200).json({
            _id: newUser.id,
            token: token,
            account: {
              username: username,
              avatar: avatar.secure_url,
            },
          });
        } else {
          res.status(409).json({ message: "This username already exist" });
        }
      } else {
        res.status(409).json({ message: "This email already exist" });
      }
    } else {
      res.status(400).json({ message: "Parameter missing" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/user/login", async (req, res) => {
  try {
    const { email, password } = req.fields;

    if (email && password) {
      const userToFind = await User.findOne({ email: email });
      if (userToFind) {
        const newHash = SHA256(userToFind.salt + password).toString(encBase64);
        const hash = userToFind.hash;
        if (hash === newHash) {
          res.status(200).json({
            _id: userToFind.id,
            token: userToFind.token,
            account: {
              username: userToFind.account.username,
            },
          });
        } else {
          res.status(401).json({ message: " Unauthorized" });
        }
      } else {
        res.status(401).json({ message: " Unauthorized" });
      }
    } else {
      res.status(401).json({ message: " Parameters missing" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
