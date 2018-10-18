'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.postOrder = functions.https.onRequest((request, response) => {
  var user = request.body.user
  var rawOrder = request.body.order
  // strip whitespaces
  rawOrder = rawOrder.replace(/\s+/g, '')
  // format user's string in an object like { "day": ["string", "of", "order_letters"] }
  var regex = /(\w+(\+\w+)*)/gi
  var dayOrders = rawOrder.match(regex)
  dayOrders = dayOrders.map(element =>
    element.toUpperCase().split('+').sort()
  )

  // this value for `nothing` was chosen because `_` is a regex friendly value
  // for var regex defined above
  let nothing = ["_"]
  var initialDays = {
    "monday": dayOrders[0] || nothing,
    "tuesday": dayOrders[1] || nothing,
    "wednesday": dayOrders[2] || nothing,
    "thursday": dayOrders[3] || nothing,
    "friday": dayOrders[4] || nothing
  }

  // construct the db object without undefined values for days names
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

exports.deleteUserOrder = functions.https.onRequest((request, response) => {
  if (request.method !== "DELETE") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  var ordersInDb = admin.database().ref('orders/' + user)
  ordersInDb.set({})

  response.send("Order deleted for " + user)
});

exports.getUserOrders = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  admin.database().ref('orders/' + user).once('value', (snapshot) => {
    var order = snapshot.val();

    if (!order) {
      response.send(user + " has no orders")
      return
    }

    admin.database().ref('weeklyMenu/days').once('value', (snapshot) => {
      var days = snapshot.val();
      var orders = {}

      Object.keys(order).forEach(dayName => {
        var menus = order[dayName]

        var ordersForDay = []
        menus.forEach(menuName => {
          var dayMenu = days[dayName][menuName]
          if (!dayMenu) { return }

          ordersForDay.push({
            "letter": dayMenu.menu.title,
            "course": dayMenu.course.name,
            "price": dayMenu.course.price
          })
        })

        if (ordersForDay.length > 0) {
          orders[dayName] = ordersForDay
        }
      })

      response.send(orders)
    });
  });
});
