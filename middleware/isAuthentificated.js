const User = require("../models/User");
const Offer = require("../models/Offer");

const isAuthentificated = async (req, res, next) => {
  console.log("on est ds le middleware");
  // si on a un token
  if (req.headers.authorization) {
    // on recup le token depuis postman
    const tokenPost = req.headers.authorization.replace("Bearer ", "");

    // on cherche en bdd si ce token existe
    const userWithToken = await User.findOne({ token: tokenPost });
    console.log(userWithToken);
    // si il existe et si son id
    if (userWithToken) {
      // on stock les infos du user trouve ds une clef req.userWithToken
      // que l on pourra reutiliser ds la route
      req.userWithToken = userWithToken;
      // on passe au reste de la route
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
};

module.exports = isAuthentificated;
