//imports
const express = require("express");
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const cloudinary = require("cloudinary").v2;

const router = express.Router();
// import des models
const User = require("../models/User");
const Offer = require("../models/Offer");
// routes
// Route pour s inscrire
router.post("/user/signup", async (req, res) => {
  console.log("route/user/signup");
  try {
    // destructuring ===> variables en dur
    const { username, email, password, newsletter } = req.fields;

    const userSameMail = await User.findOne({ email: email });
    const userSameUsername = await User.findOne({
      account: { username: username },
    });

    // si il me manque pas de parametres
    if (username && email && password && newsletter) {
      // si ce mail n est pas utilise par un autre utilisateur
      if (!userSameMail) {
        // si ce pseudo n est pas utilise
        if (!userSameUsername) {
          // on cree une chaine de cara aleatoires
          const salt = uid2(16);

          // on cree un hash = chaine de cara + mdp + encrypt en string
          const hash = SHA256(salt + password).toString(encBase64);

          //on cree un token
          const token = uid2(64);

          // recup la pict
          const picture = req.files.picture.path;
          console.log(picture);
          // la save sur cloudinary
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

// Route Login

// route pour se connecter
router.post("/user/login", async (req, res) => {
  console.log("route/user/login");

  try {
    //destructuring

    const { email, password } = req.fields;

    if (email && password) {
      // retrouve l'user qui se conncecte
      const userToFind = await User.findOne({ email: email });
      // si l utilisateur existe avec ce mail
      if (userToFind) {
        console.log(userToFind);

        // on refait un hash avec le mdp et le salt sauvegarde
        const newHash = SHA256(userToFind.salt + password).toString(encBase64);
        console.log(newHash);
        // on va chercher le hash de cet utilisateur dans la bdd
        const hash = userToFind.hash;
        console.log(hash);

        // on compare avec le hash sauvegarde en bdd
        // si ce sont les memes
        if (hash === newHash) {
          res.status(200).json({
            _id: userToFind.id,
            token: userToFind.token,
            account: {
              username: userToFind.account.username,
            },
          });
          // si ils sont differents
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

// export des routes

module.exports = router;
