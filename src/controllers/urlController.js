const urlModel = require("../models/urlModel");
const shortId = require("short-id")
const { default: mongoose } = require("mongoose");
const axios = require("axios");

const isValid = function (value) {
  if (typeof value === "undefined" || value === null) return false;
  if (typeof value === "string" && value.trim().length === 0) return false;
  if (typeof value === "number") return false;
  return true;
};

const redis = require("redis");

const { promisify } = require("util");
const { json } = require("body-parser");

//Connect to redis
const redisClient = redis.createClient(
  17226,
  "redis-17226.c264.ap-south-1-1.ec2.cloud.redislabs.com",
  { no_ready_check: true }
);
redisClient.auth("jzCWtKTxipzd6KhMeLwnTkSljdJBaLrB", function (err) {
  if (err) throw err;
});

redisClient.on("connect", async function () {
  console.log("Connected to Redis..");
});

//1. connect to the server
//2. use the commands :

//Connection setup for redis

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient); // redis server will only listen to connections made to the address specified in the bind option. 
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient); //return promise-object, with help of callback function

const createUrl = async function (req, res) {
  try {
    // validate request body
    if (!Object.keys(req.body).length > 0) {
      return res
        .status(400)
        .send({ status: false, message: "Request body can't be empty" });
    }

    // fetch longUrl and baseurl
    let longUrl = req.body.longUrl.trim();
    let baseUrl = "http://localhost:3000/";

    // validating url
    if (!isValid(longUrl))
      return res
        .status(400)
        .send({ status: false, message: "Please provide valid long url" });

    // axios call to check that link is working or not
    let urlFound = false;
    let Url = {
      method: "get",
      url: longUrl,
    };

    await axios(Url)
      .then((res) => {
        if (res.status == 201 || res.status == 200) urlFound = true;
      })
      .catch((err) => {});

    if (urlFound == false) {
      return res
        .status(400)
        .send({ status: false, message: "Invalid URL axios" });
    }

    // check if url is already cached or present in redis
    let urldata = await GET_ASYNC(`${longUrl}`);
    let data = JSON.parse(urldata);

    if (data)
      return res.status(400).send({
        status: false,
        message: `provided ${data.longUrl}url exist in redis`,
        data : data
      });
    else {
      // check if url already shortened

      let uniqueUrl = await urlModel.findOne({ longUrl: longUrl }) ;
      if (uniqueUrl) {
        await SET_ASYNC(`${longUrl}`, JSON.stringify(uniqueUrl));
        return res.status(400).send({
          status: false,
          message: `provided ${uniqueUrl.longUrl} url exist in db`,
          data : uniqueUrl
        });
      }
      // generate urlCode
      let id = shortId.generate(longUrl).toLowerCase();

      // check if urlCode already present
      let urlCode = await urlModel.findOne({ urlCode: id });
      if (urlCode) {
        await SET_ASYNC(`${longUrl}`, JSON.stringify(urlCode));
        return res.status(400).send({
          status: false,
          message: "urlCode already exist",
          data : urlCode
        });
      }

      // creating shortUrl
      let shortUrl = baseUrl + id;
      let obj = {
        longUrl: longUrl,
        shortUrl: shortUrl,
        urlCode: id
      };

      // creating url document
      let url = await urlModel.create(obj);
      await SET_ASYNC(`${longUrl}`, JSON.stringify(obj));
      return res.status(201).send({
        status: true,
        message: "created",
        data: url
      });
    }
  } catch (error) {
    return res.status(500).send({ status: false, message: error.message });
  }
};

const getLinkWithShortUrl = async function (req, res) {
  try {
    // fetching urlCode from params
    let urlCode = req.params.urlCode;

    // if urlCode found then redirect it

    //apply redis
    let urldata = await GET_ASYNC(`${urlCode}`);
    let data = JSON.parse(urldata);
    if (data) {
      return res.status(302).redirect(data.longUrl);
    } else {
      // search if urlCode already exist

      // if urlCode found then redirect it
      const getPage = await urlModel.findOne({ urlCode: urlCode });

      if (getPage) {
        await SET_ASYNC(`${urlCode}`, JSON.stringify(getPage));
        return res.status(302).redirect(getPage.longUrl);
      }
      return res
        .status(404)
        .send({ status: false, message: "url does not exist" });
    }
  } catch (error) {
    return res.status(500).send({ status: false, message: error.message });
  }
};

module.exports = { createUrl, getLinkWithShortUrl };




