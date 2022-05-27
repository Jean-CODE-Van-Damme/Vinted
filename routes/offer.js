const express = require("express");
const router = express.Router();
const isAuthentificated = require("../middleware/isAuthentificated");
const cloudinary = require("cloudinary").v2;

const User = require("../models/User");
const Offer = require("../models/Offer");
const { Router } = require("express");

router.post("/offer/publish", isAuthentificated, async (req, res) => {
  try {
    const { title, description, price, brand, size, condition, color, city } =
      req.fields;

    if (title.length <= 50) {
      if (price < 100000) {
        if (description.length < 500) {
          const pictureToUploadPath = req.files.picture.path;

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

            owner: req.userWithToken,
          });

          const id = newOffer.id;
          const result = await cloudinary.uploader.upload(pictureToUploadPath, {
            folder: `api/vinted/offers/${id}`,
          });

          newOffer.product_image = result;

          await newOffer.save();

          res.status(200).json({
            _id: newOffer.id,
            product_name: newOffer.product_name,
            product_description: newOffer.product_description,
            product_price: newOffer.product_price,
            product_details: newOffer.product_details,
            product_image: newOffer.product_image.secure_url,

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

    if (String(req.userWithToken.id) === String(offerToModify.owner)) {
      if (title) {
        if (title.length < 50) {
          offerToModify.product_name = title;
        } else {
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

      await offerToModify.markModified("product_details");

      if (newPicture) {
        await cloudinary.api.delete_resources_by_prefix(
          `api/vinted/offers/${id}`
        );

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

router.delete("/offer/delete", isAuthentificated, async (req, res) => {
  try {
    const { id } = req.fields;
    const offerisExist = await Offer.findById(id);

    if (offerisExist) {
      if (String(req.userWithToken.id) === String(offerisExist.owner)) {
        await cloudinary.api.delete_resources_by_prefix(
          `api/vinted/offers/${id}`
        );

        await cloudinary.api.delete_folder(`api/vinted/offers/${id}`);

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

router.get("/offers", async (req, res) => {
  try {
    let { page, title, priceMax, priceMin, sort } = req.query;

    const filters = {};

    if (title) {
      filters.product_name = new RegExp(title, "i");
    }

    if (priceMin) {
      filters.product_price = { $gte: Number(priceMin) };
    }

    if (priceMax) {
      if (filters.product_price) {
        filters.product_price.$lte = Number(priceMax);
      } else {
        filters.product_price = { $lte: Number(priceMax) };
      }
    }

    if (!page) {
      page = 1;
    }

    const limitOffers = 3;

    let skipPage = limitOffers * page - limitOffers;

    let counter = 1;
    if (sort === "price-desc") {
      counter = -1;
    }

    const offersToFind = await Offer.find(filters)

      .select(
        "product_name product_price product_details product_image.secure_url product_description"
      )

      .sort({ product_price: counter })

      .skip(skipPage)

      .limit(limitOffers)

      .populate({
        path: "owner",
        select: "account.username id account.avatar.secure_url",
      });

    const count = await Offer.countDocuments(filters);

    res.status(200).json({
      count: count,
      offersToFind,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

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

    res.json(offerToFindById);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
