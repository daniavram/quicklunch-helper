'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.postOrder = functions.https.onRequest((request, response) => {
  var user = request.body.user
  var rawOrder = request.body.order
  rawOrder = rawOrder.replace(/\s+/g, '')

  var regex = /(\w+(\+\w+)*)/gi
  var dayOrders = rawOrder.match(regex)
  dayOrders = dayOrders.map(element =>
    element.toUpperCase().split('+').sort()
  )

  let nothing = ["_"]
  var initialDays = {
    "monday": dayOrders[0] || nothing,
    "tuesday": dayOrders[1] || nothing,
    "wednesday": dayOrders[2] || nothing,
    "thursday": dayOrders[3] || nothing,
    "friday": dayOrders[4] || nothing
  }

  var days = {}
  if (initialDays.monday.toString() !== nothing.toString()) { days.monday = initialDays.monday }
  if (initialDays.tuesday.toString() !== nothing.toString()) { days.tuesday = initialDays.tuesday }
  if (initialDays.wednesday.toString() !== nothing.toString()) { days.wednesday = initialDays.wednesday }
  if (initialDays.thursday.toString() !== nothing.toString()) { days.thursday = initialDays.thursday }
  if (initialDays.friday.toString() !== nothing.toString()) { days.friday = initialDays.friday }

  var ordersInDb = admin.database().ref('orders/' + user)
  ordersInDb.set(days)

  response.send(days)
});

exports.deleteOrders = functions.https.onRequest((request, response) => {
  if (request.method !== "DELETE") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var ordersInDb = admin.database().ref('orders')
  ordersInDb.set({})

  response.send("Orders deleted")
});

// exports.getOrder = functions.https.onRequest((request, response) => {
//   return admin.database().ref('weeklyMenu/days/monday/' + array[0]).once('value', (snapshot) => {
//     var foundMenu = snapshot.val();
//     console.log(foundMenu);
//     response.send(foundMenu);
//   });
// });
