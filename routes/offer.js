//Imports
const express = require("express");
const router = express.Router();
const isAuthentificated = require("../middleware/isAuthentificated");
const cloudinary = require("cloudinary").v2;

// Imports Models
const User = require("../models/User");
const Offer = require("../models/Offer");
const { Router } = require("express");

//Routes

// on ajoute le middleware en arg de la route

// Route pour publier une offre
router.post("/offer/publish", isAuthentificated, async (req, res) => {
  try {
    const { title, description, price, brand, size, condition, color, city } =
      req.fields;

    if (title.length <= 50) {
      if (price < 100000) {
        if (description.length < 500) {
          //le chemin de la picture
          const pictureToUploadPath = req.files.picture.path;
          // on cree la new offer sauf l image
          const newOffer = await new Offer({
            product_name: title,
            product_description: description,
            product_price: price,
            product_details: [
              { MARQUE: brand },
              { TAILLE: size },
              { ETAT: condition },
              { COULEUR: color },
              { EMPLACEMENT: city },
            ],
            // on recupere la clef req.userWithToken de isAuthentificated qui a pour valeur userWithToken
            owner: req.userWithToken,
          });
          // meme avant d etre enregistrer la newOffer a deja une id pour enr sur cloudinary
          // ds un dossier {id}
          const id = newOffer.id;
          const result = await cloudinary.uploader.upload(pictureToUploadPath, {
            folder: `api/vinted/offers/${id}`,
          });
          // on rajoute la clef image ds newOffer
          newOffer.product_image = result;

          // on save newOffer apres
          await newOffer.save();

          console.log(req.userWithToken);

          res.status(200).json({
            _id: newOffer.id,
            product_name: newOffer.product_name,
            product_description: newOffer.product_description,
            product_price: newOffer.product_price,
            product_details: newOffer.product_details,
            product_image: newOffer.product_image.secure_url,
            // on recupere la clef req.userWithToken de isAuthentificated qui a pour valeur userWithToken
            owner: {
              account: req.userWithToken.account.username,
              _id: req.userWithToken.id,
              avatar: req.userWithToken.account.avatar.secure_url,
            },
          });
        } else {
          res.status(401).json({
            message: "Please, your descritpion must be less than 500 words ",
          });
        }
      } else {
        res
          .status(401)
          .json({ message: "Please, your price must be less than 100 000 " });
      }
    } else {
      res
        .status(401)
        .json({ message: "Please, 50 characters Maximum for the title" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route pour modifier une offre
router.put("/offer/modify", isAuthentificated, async (req, res) => {
  try {
    const {
      id,
      title,
      description,
      price,
      brand,
      size,
      condition,
      color,
      city,
    } = req.fields;

    const newPicture = req.files.picture;

    const offerToModify = await Offer.findById(id);

    //console.log("id du owner authentifie ===>", req.userWithToken.id);
    //console.log("id auteur de l offre ===>", offerToModify.owner);

    // si les id de l utilisateur identifie et l id du posteur de  annonce correspondent
    if (String(req.userWithToken.id) === String(offerToModify.owner)) {
      if (title) {
        if (title.length < 50) {
          offerToModify.product_name = title;
        } else {
          //return pour couper la route et ne pas avoir deux rep avec la offerToModify
          return res
            .status(403)
            .json({ message: "Title must be under 50 characters" });
        }
      }
      if (description) {
        if (description.length < 500) {
          offerToModify.product_description = description;
        } else {
          return res
            .status(403)
            .json({ message: "Description must be under 500 characters" });
        }
      }
      if (price) {
        if (price < 100000) {
          offerToModify.product_price = price;
        } else {
          return res
            .status(403)
            .json({ message: "Price must be under 100000" });
        }
      }

      if (brand) {
        offerToModify.product_details[0].MARQUE = brand;
      }
      if (size) {
        offerToModify.product_details[1].TAILLE = size;
      }
      if (condition) {
        offerToModify.product_details[2].ETAT = condition;
      }
      if (color) {
        offerToModify.product_details[3].COULEUR = color;
      }
      if (city) {
        offerToModify.product_details[4].EMPLACEMENT = city;
      }
      // pour supp des objets nesté, la clef est l objet le plus grand
      await offerToModify.markModified("product_details");

      if (newPicture) {
        //on vide le dossier
        await cloudinary.api.delete_resources_by_prefix(
          `api/vinted/offers/${id}`
        );
        // on cree une nouvelle pict ds le dossier cloudinary
        const pictureToModify = await cloudinary.uploader.upload(
          req.files.picture.path,
          {
            folder: `api/vinted/offers/${id}`,
          }
        );
      }

      await offerToModify.save();
      res.status(200).json(offerToModify);
    } else {
      res.status(404).json({ message: "You can only modify your  own offers" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route pour delete

router.delete("/offer/delete", isAuthentificated, async (req, res) => {
  try {
    const { id } = req.fields;
    const offerisExist = await Offer.findById(id);

    //si elle existe
    if (offerisExist) {
      // si l utilisateur authentifie est le meme que le redacteur de l annonce
      if (String(req.userWithToken.id) === String(offerisExist.owner)) {
        // vider le dossier ds couldinary
        await cloudinary.api.delete_resources_by_prefix(
          `api/vinted/offers/${id}`
        );
        // Une fois le dossier vide, on peut le supprimer
        await cloudinary.api.delete_folder(`api/vinted/offers/${id}`);

        //supp l offre
        await offerisExist.deleteOne();

        res.status(200).json({ message: "Offer deleted" });
      } else {
        res
          .status(403)
          .json({ message: "You can only delete your own offers" });
      }
    } else {
      res.status(404).json({ message: "Offer to delete doesn t exist" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Route pour retourner une offre selon les criteres demandes

router.get("/offers", async (req, res) => {
  console.log("route/offers par critere");
  try {
    // on recup les query en destructuring
    let { page, title, priceMax, priceMin, sort } = req.query;

    // on construit un objet a rentrer dans Offer.find
    const filters = {};

    // si y a un titre on rajoute une clef a l objet filters
    if (title) {
      filters.product_name = new RegExp(title, "i");
    }

    // si y a un prix min on rajoute un clef a l objet fiters
    if (priceMin) {
      filters.product_price = { $gte: Number(priceMin) };
    }
    // si y a un prix max
    if (priceMax) {
      // si y a deja un prix min on rajoute  une clef a l objet contenu ds product_price
      // ce qui equivaut a product_price = {$gte : Number(priceMin) , $lte : Number(priceMax)}
      if (filters.product_price) {
        filters.product_price.$lte = Number(priceMax);

        // sinon je rajoute juste une clef a l objet filters
      } else {
        filters.product_price = { $lte: Number(priceMax) };
      }
    }

    // si pas de para query num de la page = 1
    if (!page) {
      page = 1;
    }
    // on defini 3 offres par pages
    const limitOffers = 3;
    // les offres ignorees
    let skipPage = limitOffers * page - limitOffers;

    // um counter pour rendre dynamique le sort recu en query et on reste en prix croissant par defaut
    let counter = 1;
    if (sort === "price-desc") {
      counter = -1;
    }

    // On pourrait aussi definir un prix max et un prix min si non defini
    // if (!priceMin) {
    //   priceMin = 0;
    // }
    // if (!priceMax) {
    //   priceMax = 100000;
    // }

    // // les offres recherches auront :
    const offersToFind = await Offer.find(filters)
      // les clefs a afficher
      .select(
        "product_name product_price product_details product_image.secure_url product_description"
      )
      // le tri par ordre
      .sort({ product_price: counter })
      //offres ignorees
      .skip(skipPage)
      // offres par pages
      .limit(limitOffers)
      // les clefs de l objet lie a afficher
      .populate({
        path: "owner",
        select: "account.username id account.avatar.secure_url",
      });

    // ici le count ===> nbe total d annonces concernees
    // si juste offersToModify.length ===> nbe d offre par page
    const count = await Offer.countDocuments(filters);

    res.status(200).json({
      count: count,
      offersToFind,
    });

    // console.log(offersToFind);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Route pour retourner les details d une offre selon son id
// avec 1 parametre PARAMS

router.get("/offer/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const offerToFindById = await Offer.findById(id)
      .select(
        "product_name product_price product_details product_image.secure_url product_description"
      )

      .populate({
        path: "owner",
        select: "account.username id account.avatar.secure_url",
      });
    console.log(offerToFindById);

    res.json(offerToFindById);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }

  //res.json({ offerToFindById });
});

//Export
module.exports = router;
