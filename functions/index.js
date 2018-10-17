'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.postOrder = functions.https.onRequest((request, response) => {
  var user = request.body.user
  var rawOrder = request.body.order
  rawOrder = rawOrder.replace(/\s+/g, '')

  var regex = /(\w+(\+\w+)*)/gi
  var array = rawOrder.match(regex)
  array = array.map(element => element.toUpperCase())

  var days = {
    "monday": array[0],
    "tuesday": array[1],
    "wednesday": array[2],
    "thursday": array[3],
    "friday": array[4]
  }

  response.send(days)

  // return admin.database().ref('weeklyMenu/days/monday/' + array[0]).once('value', (snapshot) => {
  //   var foundMenu = snapshot.val();
  //   console.log(foundMenu);
  //   response.send(foundMenu);
  // });
});
