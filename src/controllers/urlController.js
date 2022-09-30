const urlModel = require("../models/urlModel");
const shortId = require("short-id");
const validUrl = require("valid-url");
//const urlShortener = require("node-url-shortener");

const isValid = function (value) {
  if (typeof value === "undefined" || value === null) return false;
  if (typeof value === "string" && value.trim().length === 0) return false;
  if (typeof value === "number") return false;
  return true;
};

const createUrl = async function (req, res) {
  try {
    // validate request body
    if (!Object.keys(req.body).length > 0) {
      return res
        .status(400)
        .send({ status: true, message: "Request body can't be empty" });
    }

    // fetch longUrl and baseurl
    let longUrl = req.body.longUrl;
    let baseUrl = "http://localhost:3000/";

    // validating url
    if (!isValid(longUrl))
      return res
        .status(400)
        .send({ status: false, msg: "Please provide valid long url" });

    if (!validUrl.isUri(longUrl.trim())) {
      return res.status(400).send({ status: true, message: "Invalid Url" });
    }

    // check if url already shortened
    let uniqueUrl = await urlModel.findOne({ longUrl: longUrl });
    if (uniqueUrl)
      return res.status(400).send({
        status: true,
        message: `provided ${uniqueUrl.longUrl} url exist in db`,
        data:uniqueUrl
      });

    // generate urlCode
    let id = shortId.generate(longUrl);

    // // check if urlCode already present
    let urlCode = await urlModel.findOne({ urlCode: id });
    if (urlCode)
      return res.status(400).send({
        status: true,
        message: "urlCode already exist",
        data:urlCode
      });

    // creating shortUrl
    let shortUrl = baseUrl + id;

    let obj = {
      longUrl: longUrl,
      shortUrl: shortUrl,
      urlCode: id,
    };

    // creating url document
    let url = await urlModel.create(obj);

    return res.status(201).send({
      status: true,
      message: "created",
      data: url,
    });
  } catch (error) {
    return res.status(500).send({ status: false, message: error.message });
  }
};

const getLinkWithShortUrl = async function (req, res) {
  try {
    // fetching urlCode from params
    let urlCode = req.params.urlCode;

    // search if urlCode already exist
    const getPage = await urlModel.findOne({ urlCode: urlCode });

    // if urlCode found then redirect it
    if (getPage) {
      return res.status(302).redirect(getPage.longUrl);
     
    }
    return res
      .status(400)
      .send({ status: false, message: "url does not exist" });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ status: false, message: err.message });
  }
};

module.exports = { createUrl, getLinkWithShortUrl };
