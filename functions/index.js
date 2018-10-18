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
  var weekOrder = {}
  if (initialDays.monday.toString() !== nothing.toString()) { weekOrder.monday = initialDays.monday }
  if (initialDays.tuesday.toString() !== nothing.toString()) { weekOrder.tuesday = initialDays.tuesday }
  if (initialDays.wednesday.toString() !== nothing.toString()) { weekOrder.wednesday = initialDays.wednesday }
  if (initialDays.thursday.toString() !== nothing.toString()) { weekOrder.thursday = initialDays.thursday }
  if (initialDays.friday.toString() !== nothing.toString()) { weekOrder.friday = initialDays.friday }

  admin.database().ref('weeklyMenu/days').once('value', (snapshot) => {
    var days = snapshot.val();
    var userOrder = {}

    Object.keys(weekOrder).forEach(dayName => {
      var menus = weekOrder[dayName]

      var ordersForDay = []
      menus.forEach(menuName => {
        var dayMenu = days[dayName][menuName]
        if (!dayMenu) { return }

        ordersForDay.push(dayMenu)
      })

      if (ordersForDay.length > 0) {
        userOrder[dayName] = ordersForDay
      }
    })

    var ordersInDb = admin.database().ref('orders/' + user)
    ordersInDb.set(userOrder)

    response.send(userOrder)
  });
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

function userOrdersFor(user) {
  return new Promise((completion) => {
    admin.database().ref('orders/' + user).once('value', (snapshot) => {
      completion(snapshot.val())
    })
  });
}

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

  userOrdersFor(user).then(userOrder => {
    if (!userOrder) {
      response.send(user + " has no orders")
      return
    }

    var filteredOrders = {}
    Object.keys(userOrder).forEach(dayName => {
      var allOrdersForDay = userOrder[dayName].map(day => {
        return {
          "menu": day.menu.title,
          "dish": day.course.name,
          "price": day.course.price
        }
      })

      filteredOrders[dayName] = allOrdersForDay
    })

    return response.send(filteredOrders)
  }).catch(reason => {
    return response.send("No orders found for " + user)
  });
});

exports.getUserTotal = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  userOrdersFor(user).then(userOrder => {
    if (!userOrder) {
      response.send(user + " has no orders")
      return
    }

    var prices = []
    Object.keys(userOrder).forEach(dayName => {
      var dayPrices = userOrder[dayName].map(day => {
        return day.course.price
      })

      prices.push(dayPrices)
    })

    var flattenedPrices = [].concat.apply([], prices)
    flattenedPrices = flattenedPrices.map(price => parseFloat(price))
    var price = flattenedPrices.reduce((a, b) => a + b, 0);

    return response.send({"total": price})
  }).catch(reason => {
    return response.send("No orders found for " + user)
  });
});

exports.getUserToday = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.send("Are you sure you know what you're doing?")
    return
  }

  var user = request.query.user
  if (!user) {
    response.send("User not specified")
    return
  }

  var date = new Date()
  var dayIndex = date.getDay()
  var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

  var dayName = days[dayIndex]

  admin.database().ref('orders/' + user + "/" + dayName).once('value', (snapshot) => {
    var userOrderForDay = snapshot.val()
    if (!userOrderForDay) {
      response.send(user + " has no order for " + dayName)
      return
    }

    var allOrdersForDay = userOrderForDay.map(day => {
      return {
        "menu": day.menu.title,
        "dish": day.course.name
      }
    })

    var todayOrder = {}
    todayOrder[dayName] = allOrdersForDay

    response.send(todayOrder)
  }).catch(reason => {
    return response.send("No orders found for " + user)
  });
});
