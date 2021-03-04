"use strict";

// npm modules
const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const values = require('object.values');
const { stringify } = require('qs')
const numbers = require('../numbers.json').results;

// application requires
const config = require("../config");

const client = twilio(config.accountSid, config.authToken);

const auth = (req, res, next) => {
  req.query.key === process.env.KEY ? next() : res.send('Incorrect Key')
}

router.get("/", auth, (req, res, next) => {
  client.messages.list({to: decodeURIComponent(req.query.phoneNumber)}).then(function(messages) {
    messages = messages.reduce(function(accumulator, currentMessage){
      if(!accumulator[currentMessage.from]) {
        accumulator[currentMessage.from] = currentMessage;
      }
      return accumulator;
    }, {});
    messages = values(messages);
    res.render('index', {
      messages: messages,
      title: "Inbox",
      numbers
    });
  });
});

router.get("/outbox", auth, (req, res, next) => {
  client.messages.list({from: decodeURIComponent(req.query.phoneNumber)}).then(function(messages) {
    messages = messages.reduce(function(accumulator, currentMessage){
      if(!accumulator[currentMessage.to]) {
        accumulator[currentMessage.to] = currentMessage;
      }
      return accumulator;
    }, {});
    messages = values(messages);
    res.render('outbox', {
      messages: messages,
      title: "Outbox",
      numbers
    });
  });
});

router.get("/messages/new", auth, function(req, res, next) {
  res.render("new", {
    title: "New message",
    numbers
  });
});

router.post("/messages", auth, function(req, res, next) {
  client.messages.create({
    from: decodeURIComponent(req.query.phoneNumber),
    to: req.body.phoneNumber,
    body: req.body.body
  }).then(function(data) {
    if (req.xhr) {
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ result: "success" }));
    } else {
      res.redirect("/messages/"+req.body.phoneNumber + "?" + stringify(req.query) +"#"+data.sid);
    }
  }).catch(function(err) {
    if (req.xhr) {
      res.setHeader('Content-Type', 'application/json');
      res.status(err.status).send(JSON.stringify(err));
    } else {
      res.redirect((req.header('Referer') || '/'));
    }
  });
});

router.get("/messages/:phoneNumber", auth, function(req, res, next) {
  let incoming = client.messages.list({
    from: req.params.phoneNumber,
    to: decodeURIComponent(req.query.phoneNumber)
  });
  let outgoing = client.messages.list({
    from: decodeURIComponent(req.query.phoneNumber),
    to: req.params.phoneNumber
  });
  Promise.all([incoming, outgoing]).then(function(values) {
    var allMessages = values[0].concat(values[1]);
    allMessages.sort(function(a, b){
      let date1 = Date.parse(a.dateCreated);
      let date2 = Date.parse(b.dateCreated);
      if (date1 == date2) { return 0; }
      else { return date1 < date2 ? -1 : 1 }
    });
    allMessages = allMessages.map(function(message){
      message.isInbound = message.direction === "inbound";
      message.isOutbound = message.direction.startsWith("outbound");
      return message;
    });
    res.render("show", {
      messages: allMessages,
      phoneNumber: req.params.phoneNumber,
      bodyClass: "messages",
      title: req.params.phoneNumber,
      numbers
    });
  });
});

module.exports = router;
